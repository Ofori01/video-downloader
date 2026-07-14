"use client";

import { useQuery } from "@tanstack/react-query";

import { healthService } from "@/services/health.service";

export function useHealthStatus() {
  return useQuery({
    queryKey: ["health-status"],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      healthService.getStatus({ signal }),
    retry: false,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
}
