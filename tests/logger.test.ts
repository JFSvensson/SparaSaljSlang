import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogger } from '../src/logger';

test('createLogger writes structured JSON with stable event fields', () => {
  const lines: string[] = [];
  const logger = createLogger(
    (line) => lines.push(line),
    () => new Date('2026-07-31T12:00:00.000Z')
  );

  logger.info('http_request', { method: 'GET', path: '/api/items', status: 200 });

  assert.deepEqual(JSON.parse(lines[0]), {
    timestamp: '2026-07-31T12:00:00.000Z',
    level: 'info',
    event: 'http_request',
    method: 'GET',
    path: '/api/items',
    status: 200,
  });
});

test('createLogger omits undefined fields', () => {
  const lines: string[] = [];
  const logger = createLogger((line) => lines.push(line));

  logger.error('request_failed', { status: 500, error: undefined });

  const entry = JSON.parse(lines[0]) as Record<string, unknown>;
  assert.equal(entry.status, 500);
  assert.equal('error' in entry, false);
});
