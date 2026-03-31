"use client";

import { useQuery } from "@tanstack/react-query";

import { healthService } from "@/services/health.service";

export function useHealthStatus() {
  return useQuery({
    queryKey: ["health-status"],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      healthService.getHealth({ signal }),
    refetchInterval: 20_000,
  });
}
