/** Stable machine-readable codes emitted by Mongorm errors. */
export const ORM_ERROR_CODES = {
  DATABASE_NOT_CONNECTED: 'DATABASE_NOT_CONNECTED',
  INVALID_QUERY: 'INVALID_QUERY',
  CURSOR_QUERY_INVALID: 'CURSOR_QUERY_INVALID',
  ESTIMATED_COUNT_FILTER_UNSUPPORTED: 'ESTIMATED_COUNT_FILTER_UNSUPPORTED',
  SCHEMA_CONFIGURATION_INVALID: 'SCHEMA_CONFIGURATION_INVALID',
} as const;

export type OrmErrorCode = (typeof ORM_ERROR_CODES)[keyof typeof ORM_ERROR_CODES];

/** Base error type emitted by the ORM. */
export class OrmError extends Error {
  constructor(
    message: string,
    readonly code: OrmErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised when an operation requires a connected database. */
export class DatabaseNotConnectedError extends OrmError {
  constructor() {
    super(
      'Database is not connected. Call db.connect() before accessing models or collections.',
      ORM_ERROR_CODES.DATABASE_NOT_CONNECTED,
    );
  }
}

/** Raised when schema, relation, or model configuration is invalid. */
export class SchemaConfigurationError extends OrmError {
  constructor(message: string) {
    super(message, ORM_ERROR_CODES.SCHEMA_CONFIGURATION_INVALID);
  }
}

/** Raised when a query configuration is not supported. */
export class InvalidQueryError extends OrmError {
  constructor(message: string, code: OrmErrorCode = ORM_ERROR_CODES.INVALID_QUERY) {
    super(message, code);
  }
}

/** Raised when cursor pagination options are incompatible. */
export class CursorQueryError extends InvalidQueryError {
  constructor(message: string) {
    super(message, ORM_ERROR_CODES.CURSOR_QUERY_INVALID);
  }
}

/** Raised when an estimated count is requested with a filter. */
export class EstimatedCountError extends InvalidQueryError {
  constructor() {
    super(
      'Estimated query counts do not support filters',
      ORM_ERROR_CODES.ESTIMATED_COUNT_FILTER_UNSUPPORTED,
    );
  }
}
