import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateUser } from '../src/auth';

test('authenticateUser accepts matching credentials', () => {
  assert.equal(authenticateUser('admin', 'change-me'), true);
});

test('authenticateUser rejects mismatched credentials', () => {
  assert.equal(authenticateUser('wrong', 'wrong'), false);
});
