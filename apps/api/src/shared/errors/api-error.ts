export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, 'validation_error', message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, 'not_found', resource + ' was not found');
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(409, 'conflict', message, details);
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'An unexpected error occurred') {
    super(500, 'internal_server_error', message);
  }
}
