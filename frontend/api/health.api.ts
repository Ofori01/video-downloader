import { httpClient } from "@/api/http-client";
import type { HealthResponse } from "@/types";

export const healthApi = {
  async getHealth(options?: { signal?: AbortSignal }): Promise<HealthResponse> {
    const response = await httpClient.get<HealthResponse>("/system/health", {
      signal: options?.signal,
    });
    return response.data;
  },
};
