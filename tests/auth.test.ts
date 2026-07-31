import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateCredentials, createPasswordHash, verifyPassword } from '../src/auth';

const developmentConfig = {
  loginUsername: 'admin',
  loginPassword: 'change-me',
  isProduction: false,
};

test('authenticateUser accepts matching local-development credentials', async () => {
  assert.equal(await authenticateCredentials('admin', 'change-me', developmentConfig), true);
});

test('authenticateUser rejects mismatched credentials', async () => {
  assert.equal(await authenticateCredentials('wrong', 'wrong', developmentConfig), false);
});

test('verifyPassword accepts a password created with createPasswordHash', async () => {
  const passwordHash = createPasswordHash('secure-password');

  assert.equal(await verifyPassword('secure-password', passwordHash), true);
});

test('verifyPassword rejects a wrong password and malformed hash', async () => {
  const passwordHash = createPasswordHash('secure-password');

  assert.equal(await verifyPassword('wrong-password', passwordHash), false);
  assert.equal(await verifyPassword('secure-password', 'not-a-valid-hash'), false);
});
