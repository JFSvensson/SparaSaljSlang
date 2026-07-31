import { createPasswordHash } from '../auth';

const password = process.argv[2];
if (!password) {
  throw new Error('Usage: npm run hash-password -- <password>');
}

console.log(createPasswordHash(password));
