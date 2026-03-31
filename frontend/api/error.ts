import axios, { type AxiosError } from "axios";

import type { ApiErrorPayload, AppError } from "@/types";

function getMessageFromPayload(
  payload: ApiErrorPayload | undefined,
): string | undefined {
  const message = payload?.message;

  if (Array.isArray(message)) {
    return message[0];
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (payload?.error && payload.error.trim()) {
    return payload.error;
  }

  return undefined;
}

export function normalizeError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorPayload>;

    if (axiosError.code === "ERR_CANCELED") {
      return {
        message: "Request was cancelled.",
        isNetworkError: false,
        isRetryable: false,
      };
    }

    const statusCode = axiosError.response?.status;
    const payload = axiosError.response?.data;
    const message =
      getMessageFromPayload(payload) ??
      axiosError.message ??
      "An unexpected API error occurred.";

    const isNetworkError = !axiosError.response;
    const isRetryable =
      isNetworkError ||
      statusCode === 408 ||
      statusCode === 425 ||
      statusCode === 429 ||
      (typeof statusCode === "number" && statusCode >= 500);

    return {
      message,
      statusCode,
      details: payload?.error,
      isNetworkError,
      isRetryable,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      isNetworkError: false,
      isRetryable: false,
    };
  }

  return {
    message: "Unknown error occurred.",
    isNetworkError: false,
    isRetryable: false,
  };
}

export function getErrorMessage(error: unknown): string {
  return normalizeError(error).message;
}
