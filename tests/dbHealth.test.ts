import test from 'node:test';
import assert from 'node:assert/strict';
import { HealthDatabase, isDatabaseAvailable } from '../src/db';

test('isDatabaseAvailable returns true when SQLite can execute a query', () => {
  const database: HealthDatabase = {
    prepare() {
      return { get() { return { value: 1 }; } };
    },
  };

  assert.equal(isDatabaseAvailable(database), true);
});

test('isDatabaseAvailable returns false when SQLite cannot execute a query', () => {
  const database: HealthDatabase = {
    prepare() {
      throw new Error('database unavailable');
    },
  };

  assert.equal(isDatabaseAvailable(database), false);
});