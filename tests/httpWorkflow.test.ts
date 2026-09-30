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
      REGISTRATION_INVITE_CODE: 'workflow-invite-code',
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

  const summaryResponse = await fetch(`${baseUrl}/api/items/summary`, {
    headers: { Cookie: authenticatedCookie },
  });
  assert.equal(summaryResponse.status, 200);
  assert.deepEqual(await summaryResponse.json(), {
    total_items: 0,
    total_votes: 0,
    save_items: 0,
    sell_items: 0,
    throw_items: 0,
    tied_items: 0,
    undecided_items: 0,
  });

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

  const uploadDirectory = path.join(appRoot, 'uploads');
  const filesBeforeInvalidThreshold = await fs.readdir(uploadDirectory);
  const invalidThresholdResponse = await uploadImageRequest(authenticatedCookie, 'invalid-threshold.png', 2.5);
  assert.equal(invalidThresholdResponse.status, 400);
  assert.deepEqual(await fs.readdir(uploadDirectory), filesBeforeInvalidThreshold);

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

  const choicesResponse = await fetch(`${baseUrl}/api/items/${item.id}/choices`, {
    headers: { Cookie: authenticatedCookie },
  });
  const choices = await choicesResponse.json() as { choices: Record<string, unknown>[] };
  assert.equal(choicesResponse.status, 200);
  assert.equal('voter_id' in choices.choices[0], false);
});

test('HTTP workflow requires unique voters for unanimous sell and creates editable drafts', async () => {
  const adminCookie = await login();
  const item = await uploadImage(adminCookie, 'consensus-item.png', 2);
  const adminSessionResponse = await fetch(`${baseUrl}/api/session`, {
    headers: { Cookie: adminCookie },
  });
  assert.deepEqual(await adminSessionResponse.json(), { is_administrator: true });

  const authOptionsResponse = await fetch(`${baseUrl}/api/auth-options`);
  assert.deepEqual(await authOptionsResponse.json(), { registration_enabled: true });

  const invalidRegistration = await registerUser('invalid-voter', 'wrong-invite-code');
  assert.equal(invalidRegistration.status, 403);

  const firstVoterCookie = await registerAndGetCookie('voter-one');
  const secondVoterCookie = await registerAndGetCookie('voter-two');
  const voterSessionResponse = await fetch(`${baseUrl}/api/session`, {
    headers: { Cookie: secondVoterCookie },
  });
  assert.deepEqual(await voterSessionResponse.json(), { is_administrator: false });
  const restrictedDeleteToken = await getCsrfToken(firstVoterCookie);
  const restrictedDelete = await fetch(`${baseUrl}/api/items/${item.id}`, {
    method: 'DELETE',
    headers: { Cookie: firstVoterCookie, 'x-csrf-token': restrictedDeleteToken },
  });
  assert.equal(restrictedDelete.status, 403);

  const firstVoteResponse = await submitVote(firstVoterCookie, item.id, 'sell');
  assert.equal(firstVoteResponse.status, 201);
  const firstVote = await firstVoteResponse.json() as { sell_ready: boolean; voter_count: number };
  assert.equal(firstVote.sell_ready, false);
  assert.equal(firstVote.voter_count, 1);

  assert.equal((await submitVote(firstVoterCookie, item.id, 'sell')).status, 409);
  const secondVoteResponse = await submitVote(secondVoterCookie, item.id, 'sell');
  assert.equal(secondVoteResponse.status, 201);
  const secondVote = await secondVoteResponse.json() as {
    sell_ready: boolean;
    listing_draft: { id: number; title: string };
  };
  assert.equal(secondVote.sell_ready, true);
  assert.equal(secondVote.listing_draft.title, 'consensus-item');

  const updateToken = await getCsrfToken(secondVoterCookie);
  const updateResponse = await fetch(`${baseUrl}/api/items/listings/${secondVote.listing_draft.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: secondVoterCookie,
      'x-csrf-token': updateToken,
    },
    body: JSON.stringify({
      title: 'Välskött föremål',
      description: 'Fungerar bra och säljs i befintligt skick.',
      price: 250,
      marketplace: 'tradera',
    }),
  });
  assert.equal(updateResponse.status, 200);
  const savedDraft = await updateResponse.json() as { title: string; price: number; marketplace: string };
  assert.equal(savedDraft.title, 'Välskött föremål');
  assert.equal(savedDraft.price, 250);
  assert.equal(savedDraft.marketplace, 'tradera');

  const directItem = await uploadImage(adminCookie, 'direct-sale.png', 3);
  const directToken = await getCsrfToken(firstVoterCookie);
  const directResponse = await fetch(`${baseUrl}/api/items/${directItem.id}/sell-direct`, {
    method: 'POST',
    headers: { Cookie: firstVoterCookie, 'x-csrf-token': directToken },
  });
  assert.equal(directResponse.status, 200);
  const directResult = await directResponse.json() as {
    item: { sell_direct: number };
    listing_draft: { id: number; title: string };
  };
  assert.equal(directResult.item.sell_direct, 1);
  assert.equal(directResult.listing_draft.title, 'direct-sale');
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

test('HTTP workflow bulk-deletes items and reports missing IDs', async () => {
  const authenticatedCookie = await login();
  const firstItem = await uploadImage(authenticatedCookie, 'bulk-first.png');
  const secondItem = await uploadImage(authenticatedCookie, 'bulk-second.png');
  const token = await getCsrfToken(authenticatedCookie);

  const response = await fetch(`${baseUrl}/api/items/bulk-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authenticatedCookie,
      'x-csrf-token': token,
    },
    body: JSON.stringify({ ids: [firstItem.id, 999999, secondItem.id] }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    deleted_ids: [firstItem.id, secondItem.id],
    missing_ids: [999999],
  });

  const missingItems = await Promise.all([
    fetch(`${baseUrl}/api/items/${firstItem.id}`, { headers: { Cookie: authenticatedCookie } }),
    fetch(`${baseUrl}/api/items/${secondItem.id}`, { headers: { Cookie: authenticatedCookie } }),
  ]);
  assert.equal(missingItems[0].status, 404);
  assert.equal(missingItems[1].status, 404);
});

test('HTTP workflow bulk-delete rejects invalid ID payloads', async () => {
  const authenticatedCookie = await login();
  const token = await getCsrfToken(authenticatedCookie);

  const response = await fetch(`${baseUrl}/api/items/bulk-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: authenticatedCookie,
      'x-csrf-token': token,
    },
    body: JSON.stringify({ ids: ['x', 1] }),
  });
  assert.equal(response.status, 400);
});

test('HTTP workflow enforces the upload rate limit', async () => {
  const authenticatedCookie = await login();
  let limitedResponse: Response | undefined;
  let successfulRequests = 0;

  for (let attempt = 0; attempt < 21; attempt += 1) {
    const response = await uploadImageRequest(authenticatedCookie, `rate-limit-${attempt}.png`);
    if (response.status === 429) {
      limitedResponse = response;
      break;
    }
    assert.equal(response.status, 201);
    successfulRequests += 1;
  }

  assert.ok(limitedResponse, 'Expected the upload rate limit to reject a request');
  assert.ok(successfulRequests > 0, 'Expected some uploads to remain below the shared test limit');
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

async function registerUser(username: string, inviteCode: string): Promise<Response> {
  const initialSession = await createSession();
  const token = await getCsrfToken(initialSession.cookie);
  return fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: initialSession.cookie,
      'x-csrf-token': token,
    },
    body: JSON.stringify({ username, password: 'voter-password-123', inviteCode }),
  });
}

async function registerAndGetCookie(username: string): Promise<string> {
  const response = await registerUser(username, 'workflow-invite-code');
  assert.equal(response.status, 201);
  return readSessionCookie(response);
}

async function submitVote(cookie: string, itemId: number, choice: string): Promise<Response> {
  const token = await getCsrfToken(cookie);
  return fetch(`${baseUrl}/api/items/${itemId}/choices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'x-csrf-token': token,
    },
    body: JSON.stringify({ choice }),
  });
}

async function uploadImage(
  cookie: string,
  originalName: string,
  requiredVotes = 2
): Promise<{ id: number; filename: string; original_name: string }> {
  const response = await uploadImageRequest(cookie, originalName, requiredVotes);
  assert.equal(response.status, 201);
  return await response.json() as { id: number; filename: string; original_name: string };
}

async function uploadImageRequest(cookie: string, originalName: string, requiredVotes = 2): Promise<Response> {
  const token = await getCsrfToken(cookie);
  const formData = new FormData();
  formData.append(
    'image',
    new Blob(['image-content'], { type: 'image/png' }),
    originalName
  );
  formData.append('requiredVotes', String(requiredVotes));

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
