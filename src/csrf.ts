import { csrfSync } from 'csrf-sync';

export const {
  csrfSynchronisedProtection,
  generateToken,
} = csrfSync({
  errorConfig: {
    statusCode: 403,
    message: 'Invalid CSRF token.',
    code: 'EBADCSRFTOKEN',
  },
});
