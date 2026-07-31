export interface PublicError {
  status: number;
  body: { error: string };
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function toPublicError(error: unknown): PublicError {
  if (error instanceof HttpError) {
    return { status: error.status, body: { error: error.message } };
  }

  if (hasCsrfErrorCode(error)) {
    return { status: 403, body: { error: 'Invalid CSRF token.' } };
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

function hasCsrfErrorCode(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'EBADCSRFTOKEN';
}
