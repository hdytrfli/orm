import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { ApiError } from '@/libraries/errors';
import type { ApiResponse } from '@/libraries/response';
import { log } from '@/middlewares/http-logger';

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: error.issues,
      },
    });

    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  log.error(
    {
      err: error,
      method: req.method,
      url: req.originalUrl,
    },
    'Unhandled API error',
  );

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'internal_server_error',
      message: 'An unexpected error occurred',
    },
  };

  res.status(500).json(response);
};
