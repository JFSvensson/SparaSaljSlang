import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from './config';

const DB_PATH = path.join(config.dataDir, 'sparasaljslang.db');

if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS choices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    choice TEXT NOT NULL CHECK(choice IN ('save', 'sell', 'throw')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );
`);

export interface HealthDatabase {
  prepare(sql: string): { get(): unknown };
}

export function isDatabaseAvailable(database: HealthDatabase = db): boolean {
  try {
    database.prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}

export function closeDatabase(): void {
  if (db.open) {
    db.close();
  }
}

export interface Item {
  id: number;
  filename: string;
  original_name: string;
  created_at: string;
}

export interface Choice {
  id: number;
  item_id: number;
  choice: 'save' | 'sell' | 'throw';
  created_at: string;
}

export interface ItemWithChoices extends Item {
  save_count: number;
  sell_count: number;
  throw_count: number;
}

export const itemsDb = {
  create(filename: string, originalName: string): Item {
    const stmt = db.prepare(
      'INSERT INTO items (filename, original_name) VALUES (?, ?)'
    );
    const result = stmt.run(filename, originalName);
    return db
      .prepare('SELECT * FROM items WHERE id = ?')
      .get(result.lastInsertRowid) as Item;
  },

  getAll(): ItemWithChoices[] {
    return db
      .prepare(`
        SELECT
          i.*,
          COALESCE(SUM(CASE WHEN c.choice = 'save' THEN 1 ELSE 0 END), 0) AS save_count,
          COALESCE(SUM(CASE WHEN c.choice = 'sell' THEN 1 ELSE 0 END), 0) AS sell_count,
          COALESCE(SUM(CASE WHEN c.choice = 'throw' THEN 1 ELSE 0 END), 0) AS throw_count
        FROM items i
        LEFT JOIN choices c ON c.item_id = i.id
        GROUP BY i.id
        ORDER BY i.created_at DESC
      `)
      .all() as ItemWithChoices[];
  },

  getById(id: number): Item | undefined {
    return db
      .prepare('SELECT * FROM items WHERE id = ?')
      .get(id) as Item | undefined;
  },

  delete(id: number): void {
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
  },
};

export const choicesDb = {
  create(itemId: number, choice: 'save' | 'sell' | 'throw'): Choice {
    const stmt = db.prepare(
      'INSERT INTO choices (item_id, choice) VALUES (?, ?)'
    );
    const result = stmt.run(itemId, choice);
    return db
      .prepare('SELECT * FROM choices WHERE id = ?')
      .get(result.lastInsertRowid) as Choice;
  },

  getByItemId(itemId: number): Choice[] {
    return db
      .prepare('SELECT * FROM choices WHERE item_id = ? ORDER BY created_at DESC')
      .all(itemId) as Choice[];
  },

  getCounts(itemId: number): { save: number; sell: number; throw: number } {
    const row = db
      .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN choice = 'save' THEN 1 ELSE 0 END), 0) AS save,
          COALESCE(SUM(CASE WHEN choice = 'sell' THEN 1 ELSE 0 END), 0) AS sell,
          COALESCE(SUM(CASE WHEN choice = 'throw' THEN 1 ELSE 0 END), 0) AS throw
        FROM choices WHERE item_id = ?
      `)
      .get(itemId) as { save: number; sell: number; throw: number };
    return row;
  },
};

export default db;
