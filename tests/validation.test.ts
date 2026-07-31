import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePositiveInt, isAllowedChoice, isAllowedImageMimeType } from '../src/validation';

test('parsePositiveInt accepts valid positive integers', () => {
  assert.equal(parsePositiveInt('7'), 7);
  assert.equal(parsePositiveInt(' 12 '), 12);
});

test('parsePositiveInt rejects invalid values', () => {
  assert.equal(parsePositiveInt('abc'), null);
  assert.equal(parsePositiveInt('0'), null);
  assert.equal(parsePositiveInt('-3'), null);
});

test('isAllowedChoice accepts supported choices', () => {
  assert.equal(isAllowedChoice('save'), true);
  assert.equal(isAllowedChoice('throw'), true);
});

test('isAllowedChoice rejects unsupported values', () => {
  assert.equal(isAllowedChoice('unknown'), false);
  assert.equal(isAllowedChoice(undefined), false);
});

test('isAllowedImageMimeType accepts supported image types', () => {
  assert.equal(isAllowedImageMimeType('image/png'), true);
  assert.equal(isAllowedImageMimeType('image/webp'), true);
});

test('isAllowedImageMimeType rejects unsupported types', () => {
  assert.equal(isAllowedImageMimeType('application/pdf'), false);
  assert.equal(isAllowedImageMimeType('image/svg+xml'), false);
});
