import test from 'node:test';
import assert from 'node:assert/strict';
import { closeResources } from '../src/shutdown';

test('closeResources closes the HTTP server before closing SQLite', async () => {
  const events: string[] = [];
  const server = {
    close(callback: (error?: Error) => void) {
      events.push('close-server');
      callback();
    },
  };

  await closeResources(server, () => events.push('close-database'));

  assert.deepEqual(events, ['close-server', 'close-database']);
});

test('closeResources rejects when the HTTP server cannot close', async () => {
  const server = {
    close(callback: (error?: Error) => void) {
      callback(new Error('server close failed'));
    },
  };

  await assert.rejects(() => closeResources(server, () => {}), /server close failed/);
});
