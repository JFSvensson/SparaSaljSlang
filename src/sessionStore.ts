import Database from 'better-sqlite3';
import session from 'express-session';
import db from './db';

interface StoredSession {
  data: string;
}

export class SqliteSessionStore extends session.Store {
  constructor(private readonly database: Database.Database = db) {
    super();
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        sid TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  get(sid: string, callback: (error?: Error | null, session?: session.SessionData | null) => void): void {
    try {
      const row = this.database
        .prepare('SELECT data FROM app_sessions WHERE sid = ? AND expires_at > ?')
        .get(sid, Date.now()) as StoredSession | undefined;
      callback(null, row ? deserializeSession(row.data) : null);
    } catch (error) {
      callback(error instanceof Error ? error : new Error('Unable to read session'));
    }
  }

  set(sid: string, sessionData: session.SessionData, callback?: (error?: Error | null) => void): void {
    try {
      this.database.prepare('DELETE FROM app_sessions WHERE expires_at <= ?').run(Date.now());
      this.database.prepare(`
        INSERT INTO app_sessions (sid, data, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
      `).run(sid, JSON.stringify(sessionData), getExpiry(sessionData));
      callback?.(null);
    } catch (error) {
      callback?.(error instanceof Error ? error : new Error('Unable to save session'));
    }
  }

  destroy(sid: string, callback?: (error?: Error | null) => void): void {
    try {
      this.database.prepare('DELETE FROM app_sessions WHERE sid = ?').run(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error instanceof Error ? error : new Error('Unable to destroy session'));
    }
  }

  touch(sid: string, sessionData: session.SessionData, callback?: (error?: Error | null) => void): void {
    try {
      this.database
        .prepare('UPDATE app_sessions SET expires_at = ? WHERE sid = ?')
        .run(getExpiry(sessionData), sid);
      callback?.(null);
    } catch (error) {
      callback?.(error instanceof Error ? error : new Error('Unable to update session'));
    }
  }
}

function getExpiry(sessionData: session.SessionData): number {
  const expires = sessionData.cookie?.expires;
  if (expires instanceof Date) {
    return expires.getTime();
  }

  const maxAge = sessionData.cookie?.maxAge;
  return Date.now() + (typeof maxAge === 'number' ? maxAge : 8 * 60 * 60 * 1000);
}

function deserializeSession(data: string): session.SessionData {
  const sessionData = JSON.parse(data) as session.SessionData;
  const expires = sessionData.cookie?.expires;
  if (typeof expires === 'string') {
    sessionData.cookie.expires = new Date(expires);
  }
  return sessionData;
}
