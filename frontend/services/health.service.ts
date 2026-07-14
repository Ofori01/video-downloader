import { healthApi } from "@/api/health.api";
import type { SystemStatusResponse } from "@/types";

export const healthService = {
  getStatus(options?: { signal?: AbortSignal }): Promise<SystemStatusResponse> {
    return healthApi.getStatus(options);
  },
};
