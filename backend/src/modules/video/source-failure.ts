export const GENERIC_SOURCE_BUSY_MESSAGE = 'Server busy. Try again later.';

export class SourceAccessRejectedError extends Error {
  constructor(message = GENERIC_SOURCE_BUSY_MESSAGE) {
    super(message);
    this.name = SourceAccessRejectedError.name;
  }
}

export function isSourceAccessRejectedError(error: unknown): boolean {
  if (error instanceof SourceAccessRejectedError) {
    return true;
  }

  if (error instanceof Error) {
    return error.message.includes(GENERIC_SOURCE_BUSY_MESSAGE);
  }

  return typeof error === 'string'
    ? error.includes(GENERIC_SOURCE_BUSY_MESSAGE)
    : false;
}
