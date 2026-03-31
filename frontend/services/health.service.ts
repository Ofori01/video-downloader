import { healthApi } from "@/api/health.api";
import type { HealthResponse } from "@/types";

export const healthService = {
  getHealth(options?: { signal?: AbortSignal }): Promise<HealthResponse> {
    return healthApi.getHealth(options);
  },
};
