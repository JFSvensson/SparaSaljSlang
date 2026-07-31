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

async function createSession(): Promise<{ cookie: string }> {
  const response = await fetch(`${baseUrl}/api/csrf-token`);
  assert.equal(response.status, 200);
  return { cookie: readSessionCookie(response) };
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
