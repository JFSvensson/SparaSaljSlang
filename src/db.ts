import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    required_votes INTEGER NOT NULL DEFAULT 2 CHECK(required_votes BETWEEN 1 AND 50),
    sell_direct INTEGER NOT NULL DEFAULT 0 CHECK(sell_direct IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS choices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    choice TEXT NOT NULL CHECK(choice IN ('save', 'sell', 'throw')),
    voter_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS voters (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS listing_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER,
    marketplace TEXT NOT NULL CHECK(marketplace IN ('blocket', 'tradera', 'other')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );
`);

const itemColumns = db.pragma('table_info(items)') as { name: string }[];
if (!itemColumns.some((column) => column.name === 'required_votes')) {
  db.exec('ALTER TABLE items ADD COLUMN required_votes INTEGER NOT NULL DEFAULT 2 CHECK(required_votes BETWEEN 1 AND 50)');
}
if (!itemColumns.some((column) => column.name === 'sell_direct')) {
  db.exec('ALTER TABLE items ADD COLUMN sell_direct INTEGER NOT NULL DEFAULT 0 CHECK(sell_direct IN (0, 1))');
}

const choiceColumns = db.pragma('table_info(choices)') as { name: string }[];
if (!choiceColumns.some((column) => column.name === 'voter_id')) {
  db.exec('ALTER TABLE choices ADD COLUMN voter_id TEXT');
}

db.exec('CREATE UNIQUE INDEX IF NOT EXISTS choices_one_vote_per_voter ON choices(item_id, voter_id) WHERE voter_id IS NOT NULL');

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
  required_votes: number;
  sell_direct: number;
}

export interface Choice {
  id: number;
  item_id: number;
  choice: 'save' | 'sell' | 'throw';
  created_at: string;
  voter_id: string | null;
}

export interface ItemWithChoices extends Item {
  save_count: number;
  sell_count: number;
  throw_count: number;
  voter_count: number;
  sell_voter_count: number;
}

export const itemsDb = {
  create(filename: string, originalName: string, requiredVotes = 2): Item {
    const stmt = db.prepare(
      'INSERT INTO items (filename, original_name, required_votes) VALUES (?, ?, ?)'
    );
    const result = stmt.run(filename, originalName, requiredVotes);
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
          COALESCE(SUM(CASE WHEN c.choice = 'throw' THEN 1 ELSE 0 END), 0) AS throw_count,
          COUNT(DISTINCT c.voter_id) AS voter_count,
          COUNT(DISTINCT CASE WHEN c.choice = 'sell' THEN c.voter_id END) AS sell_voter_count
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
  create(itemId: number, choice: 'save' | 'sell' | 'throw', voterId: string): Choice {
    const stmt = db.prepare(
      'INSERT INTO choices (item_id, choice, voter_id) VALUES (?, ?, ?)'
    );
    const result = stmt.run(itemId, choice, voterId);
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

  getVoterStats(itemId: number): { voter_count: number; sell_voter_count: number } {
    return db
      .prepare(`
        SELECT
          COUNT(DISTINCT voter_id) AS voter_count,
          COUNT(DISTINCT CASE WHEN choice = 'sell' THEN voter_id END) AS sell_voter_count
        FROM choices WHERE item_id = ? AND voter_id IS NOT NULL
      `)
      .get(itemId) as { voter_count: number; sell_voter_count: number };
  },

  getChoiceByVoter(itemId: number, voterId: string): Choice | undefined {
    return db
      .prepare('SELECT * FROM choices WHERE item_id = ? AND voter_id = ?')
      .get(itemId, voterId) as Choice | undefined;
  },
};

export interface Voter {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface ListingDraft {
  id: number;
  item_id: number;
  title: string;
  description: string;
  price: number | null;
  marketplace: 'blocket' | 'tradera' | 'other';
  created_at: string;
  filename: string;
  original_name: string;
}

export const listingDraftsDb = {
  ensureForItem(itemId: number, directSale = false): ListingDraft | undefined {
    const createDraft = db.transaction(() => {
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as Item | undefined;
      if (!item) {
        return undefined;
      }
      if (directSale) {
        db.prepare('UPDATE items SET sell_direct = 1 WHERE id = ?').run(itemId);
      }
      const title = item.original_name.replace(/\.[^.]+$/, '').trim() || item.original_name;
      db.prepare(`
        INSERT OR IGNORE INTO listing_drafts (item_id, title, marketplace)
        VALUES (?, ?, 'other')
      `).run(itemId, title);
      return db.prepare(`
        SELECT d.*, i.filename, i.original_name
        FROM listing_drafts d
        JOIN items i ON i.id = d.item_id
        WHERE d.item_id = ?
      `).get(itemId) as ListingDraft;
    });
    return createDraft();
  },

  getAll(): ListingDraft[] {
    return db.prepare(`
      SELECT d.*, i.filename, i.original_name
      FROM listing_drafts d
      JOIN items i ON i.id = d.item_id
      ORDER BY d.created_at DESC, d.id DESC
    `).all() as ListingDraft[];
  },

  update(
    id: number,
    fields: Pick<ListingDraft, 'title' | 'description' | 'price' | 'marketplace'>
  ): ListingDraft | undefined {
    const result = db.prepare(`
      UPDATE listing_drafts
      SET title = ?, description = ?, price = ?, marketplace = ?
      WHERE id = ?
    `).run(fields.title, fields.description, fields.price, fields.marketplace, id);
    if (result.changes === 0) {
      return undefined;
    }
    return db.prepare(`
      SELECT d.*, i.filename, i.original_name
      FROM listing_drafts d
      JOIN items i ON i.id = d.item_id
      WHERE d.id = ?
    `).get(id) as ListingDraft;
  },
};

export const votersDb = {
  create(username: string, passwordHash: string): Voter {
    const id = randomUUID();
    db.prepare('INSERT INTO voters (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, passwordHash);
    return db.prepare('SELECT * FROM voters WHERE id = ?').get(id) as Voter;
  },

  getByUsername(username: string): Voter | undefined {
    return db
      .prepare('SELECT * FROM voters WHERE username = ? COLLATE NOCASE')
      .get(username) as Voter | undefined;
  },
};

export default db;
