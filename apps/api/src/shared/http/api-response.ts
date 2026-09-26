export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const successResponse = <T>(data: T): ApiSuccess<T> => ({
  success: true,
  data,
});
