import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import session from 'express-session';
import { SqliteSessionStore } from '../src/sessionStore';

function createSession(): session.SessionData {
  return {
    cookie: {
      maxAge: 60_000,
      originalMaxAge: 60_000,
      expires: new Date(Date.now() + 60_000),
      secure: false,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    },
    isAuthenticated: true,
  };
}

function saveSession(store: SqliteSessionStore, sessionId: string, sessionData: session.SessionData): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(sessionId, sessionData, (error) => error ? reject(error) : resolve());
  });
}

function loadSession(store: SqliteSessionStore, sessionId: string): Promise<session.SessionData | null> {
  return new Promise((resolve, reject) => {
    store.get(sessionId, (error, sessionData) => error ? reject(error) : resolve(sessionData ?? null));
  });
}

test('SqliteSessionStore saves and retrieves a session', async () => {
  const database = new Database(':memory:');
  const store = new SqliteSessionStore(database);
  const sessionData = createSession();

  await saveSession(store, 'session-1', sessionData);

  assert.deepEqual(await loadSession(store, 'session-1'), sessionData);
  database.close();
});

test('SqliteSessionStore destroys a session', async () => {
  const database = new Database(':memory:');
  const store = new SqliteSessionStore(database);

  await saveSession(store, 'session-2', createSession());
  await new Promise<void>((resolve, reject) => {
    store.destroy('session-2', (error) => error ? reject(error) : resolve());
  });

  assert.equal(await loadSession(store, 'session-2'), null);
  database.close();
});
