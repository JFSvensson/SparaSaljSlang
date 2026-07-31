import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, toPublicError } from '../src/errors';

test('toPublicError preserves intentional HTTP errors', () => {
  assert.deepEqual(toPublicError(new HttpError(404, 'Item not found')), {
    status: 404,
    body: { error: 'Item not found' },
  });
});

test('toPublicError hides unexpected error details', () => {
  assert.deepEqual(toPublicError(new Error('database details')), {
    status: 500,
    body: { error: 'Internal server error' },
  });
});
