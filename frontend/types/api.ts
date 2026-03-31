export interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export interface AppError {
  message: string;
  statusCode?: number;
  details?: string;
  isNetworkError: boolean;
  isRetryable: boolean;
}
