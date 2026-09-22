/** Base error type emitted by the ORM. */
export class OrmError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised when an operation requires a connected database. */
export class DatabaseNotConnectedError extends OrmError {
  constructor() {
    super('Database is not connected', 'DATABASE_NOT_CONNECTED');
  }
}

/** Raised when a query configuration is not supported. */
export class InvalidQueryError extends OrmError {
  constructor(message: string, code = 'INVALID_QUERY') {
    super(message, code);
  }
}

/** Raised when cursor pagination options are incompatible. */
export class CursorQueryError extends InvalidQueryError {
  constructor(message: string) {
    super(message, 'CURSOR_QUERY_INVALID');
  }
}

/** Raised when an estimated count is requested with a filter. */
export class EstimatedCountError extends InvalidQueryError {
  constructor() {
    super('Estimated query counts do not support filters', 'ESTIMATED_COUNT_FILTER_UNSUPPORTED');
  }
}
