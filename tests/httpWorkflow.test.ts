import test from 'node:test';
import assert from 'node:assert/strict';
import { ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..', '..');
const port = 4100 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const { LOGIN_PASSWORD_HASH: _ignoredPasswordHash, ...environment } = process.env;

let appProcess: ChildProcess;
let appRoot: string;

test.before(async () => {
  appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sparasaljslang-http-'));
  appProcess = spawn(process.execPath, ['dist/src/server.js'], {
    cwd: projectRoot,
    env: {
      ...environment,
      APP_ROOT: appRoot,
      NODE_ENV: 'development',
      PORT: String(port),
      LOGIN_USERNAME: 'workflow-admin',
      LOGIN_PASSWORD: 'workflow-password',
    },
    stdio: 'ignore',
  });

  await waitForHealth();
});

test.after(async () => {
  appProcess.kill('SIGTERM');
  await once(appProcess, 'exit');
  await fs.rm(appRoot, { recursive: true, force: true });
});

test('HTTP workflow enforces CSRF, authenticates, validates choices, and revokes logout sessions', async () => {
  const initialSession = await createSession();

  const missingTokenResponse = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: initialSession.cookie },
    body: JSON.stringify({ username: 'workflow-admin', password: 'workflow-password' }),
  });
  assert.equal(missingTokenResponse.status, 403);

  const initialToken = await getCsrfToken(initialSession.cookie);
  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: initialSession.cookie,
      'x-csrf-token': initialToken,
    },
    body: JSON.stringify({ username: 'workflow-admin', password: 'workflow-password' }),
  });
  assert.equal(loginResponse.status, 200);

  const authenticatedCookie = readSessionCookie(loginResponse);
  const itemsResponse = await fetch(`${baseUrl}/api/items`, {
    headers: { Cookie: authenticatedCookie },
  });
  assert.equal(itemsResponse.status, 200);
  assert.deepEqual(await itemsResponse.json(), []);

  const csrfToken = await getCsrfToken(authenticatedCookie);
  const invalidChoiceResponse = await fetch(`${baseUrl}/api/items/1/choices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authenticatedCookie,
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ choice: 'invalid' }),
  });
  assert.equal(invalidChoiceResponse.status, 400);

  const logoutToken = await getCsrfToken(authenticatedCookie);
  const logoutResponse = await fetch(`${baseUrl}/api/logout`, {
    method: 'POST',
    headers: { Cookie: authenticatedCookie, 'x-csrf-token': logoutToken },
  });
  assert.equal(logoutResponse.status, 200);

  const revokedSessionResponse = await fetch(`${baseUrl}/api/items`, {
    headers: { Cookie: authenticatedCookie },
  });
  assert.equal(revokedSessionResponse.status, 401);
});

test('HTTP workflow uploads a valid image, normalizes its display name, and removes it', async () => {
  const authenticatedCookie = await login();
  const uploadToken = await getCsrfToken(authenticatedCookie);
  const formData = new FormData();
  formData.append(
    'image',
    new Blob(['image-content'], { type: 'image/png' }),
    '../unsafe:name?.png'
  );

  const uploadResponse = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: { Cookie: authenticatedCookie, 'x-csrf-token': uploadToken },
    body: formData,
  });
  assert.equal(uploadResponse.status, 201);
  const item = await uploadResponse.json() as { id: number; filename: string; original_name: string };
  assert.equal(item.original_name, 'unsafe_name_.png');
  await fs.access(path.join(appRoot, 'uploads', item.filename));

  const deleteToken = await getCsrfToken(authenticatedCookie);
  const deleteResponse = await fetch(`${baseUrl}/api/items/${item.id}`, {
    method: 'DELETE',
    headers: { Cookie: authenticatedCookie, 'x-csrf-token': deleteToken },
  });
  assert.equal(deleteResponse.status, 200);
  await assert.rejects(() => fs.access(path.join(appRoot, 'uploads', item.filename)));

  const missingItemResponse = await fetch(`${baseUrl}/api/items/${item.id}`, {
    headers: { Cookie: authenticatedCookie },
  });
  assert.equal(missingItemResponse.status, 404);
});

test('HTTP workflow rejects invalid uploads and invalid item IDs', async () => {
  const authenticatedCookie = await login();
  const token = await getCsrfToken(authenticatedCookie);
  const nonImageFormData = new FormData();
  nonImageFormData.append(
    'image',
    new Blob(['not-an-image'], { type: 'text/plain' }),
    'notes.txt'
  );

  const nonImageResponse = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: { Cookie: authenticatedCookie, 'x-csrf-token': token },
    body: nonImageFormData,
  });
  assert.equal(nonImageResponse.status, 400);

  const missingFileToken = await getCsrfToken(authenticatedCookie);
  const missingFileResponse = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: { Cookie: authenticatedCookie, 'x-csrf-token': missingFileToken },
    body: new FormData(),
  });
  assert.equal(missingFileResponse.status, 400);

  const invalidIdResponse = await fetch(`${baseUrl}/api/items/not-an-id`, {
    headers: { Cookie: authenticatedCookie },
  });
  assert.equal(invalidIdResponse.status, 400);
});

test('HTTP workflow persists a valid vote and returns updated counts', async () => {
  const authenticatedCookie = await login();
  const item = await uploadImage(authenticatedCookie, 'vote-target.png');
  const voteToken = await getCsrfToken(authenticatedCookie);

  const voteResponse = await fetch(`${baseUrl}/api/items/${item.id}/choices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authenticatedCookie,
      'x-csrf-token': voteToken,
    },
    body: JSON.stringify({ choice: 'save' }),
  });
  assert.equal(voteResponse.status, 201);
  const voteResult = await voteResponse.json() as {
    choice: { item_id: number; choice: string };
    counts: { save: number; sell: number; throw: number };
  };
  assert.equal(voteResult.choice.item_id, item.id);
  assert.equal(voteResult.choice.choice, 'save');
  assert.deepEqual(voteResult.counts, { save: 1, sell: 0, throw: 0 });
});

test('HTTP workflow rejects files larger than 10 MB', async () => {
  const authenticatedCookie = await login();
  const token = await getCsrfToken(authenticatedCookie);
  const formData = new FormData();
  formData.append(
    'image',
    new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/png' }),
    'too-large.png'
  );

  const response = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: { Cookie: authenticatedCookie, 'x-csrf-token': token },
    body: formData,
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'File too large' });
});

test('HTTP workflow enforces the upload rate limit', async () => {
  const authenticatedCookie = await login();
  let limitedResponse: Response | undefined;

  for (let attempt = 0; attempt < 21; attempt += 1) {
    const response = await uploadImageRequest(authenticatedCookie, `rate-limit-${attempt}.png`);
    if (response.status === 429) {
      limitedResponse = response;
      break;
    }
    assert.equal(response.status, 201);
  }

  assert.ok(limitedResponse, 'Expected the upload rate limit to reject a request');
  assert.equal(limitedResponse.status, 429);
  assert.deepEqual(await limitedResponse.json(), {
    error: 'Upload limit reached, please try again later.',
  });
});

async function createSession(): Promise<{ cookie: string }> {
  const response = await fetch(`${baseUrl}/api/csrf-token`);
  assert.equal(response.status, 200);
  return { cookie: readSessionCookie(response) };
}

async function login(): Promise<string> {
  const initialSession = await createSession();
  const token = await getCsrfToken(initialSession.cookie);
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: initialSession.cookie,
      'x-csrf-token': token,
    },
    body: JSON.stringify({ username: 'workflow-admin', password: 'workflow-password' }),
  });
  assert.equal(response.status, 200);
  return readSessionCookie(response);
}

async function uploadImage(
  cookie: string,
  originalName: string
): Promise<{ id: number; filename: string; original_name: string }> {
  const response = await uploadImageRequest(cookie, originalName);
  assert.equal(response.status, 201);
  return await response.json() as { id: number; filename: string; original_name: string };
}

async function uploadImageRequest(cookie: string, originalName: string): Promise<Response> {
  const token = await getCsrfToken(cookie);
  const formData = new FormData();
  formData.append(
    'image',
    new Blob(['image-content'], { type: 'image/png' }),
    originalName
  );

  return fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: { Cookie: cookie, 'x-csrf-token': token },
    body: formData,
  });
}

async function getCsrfToken(cookie: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/csrf-token`, {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { token: string };
  return body.token;
}

function readSessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'Expected a session cookie');
  return setCookie.split(';', 1)[0];
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The child process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timed out waiting for the HTTP test server');
}
