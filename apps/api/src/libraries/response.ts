import type { RequestHandler } from 'express';

interface CommonResponse {
  requestId?: string;
}

export interface ApiSuccess<T = unknown> extends CommonResponse {
  success: true;
  data: T;
}

export interface ApiFailure extends CommonResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiFailure;
export type ApiHandler = RequestHandler<Record<string, string>, ApiResponse, unknown>;
