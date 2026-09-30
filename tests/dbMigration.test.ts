import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('database migration preserves legacy votes without assigning them to voters', () => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sparasaljslang-migration-'));
  try {
    const dataDir = path.join(appRoot, 'data');
    fs.mkdirSync(dataDir);
    const databasePath = path.join(dataDir, 'sparasaljslang.db');

    const legacyDatabase = new Database(databasePath);
    legacyDatabase.exec(`
    CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE choices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      choice TEXT NOT NULL CHECK(choice IN ('save', 'sell', 'throw')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );
    CREATE TABLE listing_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price INTEGER,
      marketplace TEXT NOT NULL CHECK(marketplace IN ('blocket', 'tradera', 'other')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );
    INSERT INTO items (filename, original_name) VALUES ('legacy.png', 'legacy.png');
    INSERT INTO choices (item_id, choice) VALUES (1, 'sell');
    INSERT INTO listing_drafts (item_id, title, description, price, marketplace)
      VALUES (1, 'Legacy listing', 'Existing description', 100, 'blocket');
    `);
    legacyDatabase.close();

    const migration = spawnSync(
      process.execPath,
      ['-e', "const database = require('./dist/src/db'); database.closeDatabase();"],
      {
        cwd: path.resolve(__dirname, '..', '..'),
        env: { ...process.env, APP_ROOT: appRoot },
        encoding: 'utf8',
      }
    );
    assert.equal(migration.status, 0, migration.stderr);

    const migratedDatabase = new Database(databasePath);
    const item = migratedDatabase.prepare(
      'SELECT required_votes, sell_direct, voting_round FROM items WHERE id = 1'
    ).get() as {
      required_votes: number;
      sell_direct: number;
      voting_round: number;
    };
    const vote = migratedDatabase.prepare('SELECT choice, voter_id FROM choices WHERE item_id = 1').get() as {
      choice: string;
      voter_id: string | null;
    };
    const listingDraft = migratedDatabase.prepare(`
      SELECT condition, marketplace_name
      FROM listing_drafts WHERE item_id = 1
    `).get() as { condition: string; marketplace_name: string };
    assert.deepEqual(item, { required_votes: 2, sell_direct: 0, voting_round: 1 });
    assert.deepEqual(vote, { choice: 'sell', voter_id: null });
    assert.deepEqual(listingDraft, { condition: '', marketplace_name: '' });
    migratedDatabase.close();
  } finally {
    fs.rmSync(appRoot, { recursive: true, force: true });
  }
});
