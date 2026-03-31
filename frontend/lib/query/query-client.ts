import { QueryClient } from "@tanstack/react-query";

import { normalizeError } from "@/api/error";

function shouldRetry(failureCount: number, error: unknown): boolean {
  const normalized = normalizeError(error);

  if (!normalized.isRetryable) {
    return false;
  }

  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: (failureCount, error) => {
          const normalized = normalizeError(error);
          return normalized.isNetworkError && failureCount < 1;
        },
      },
    },
  });
}
