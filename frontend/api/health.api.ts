import { httpClient } from "@/api/http-client";
import type { SystemStatusResponse } from "@/types";

export const healthApi = {
  async getStatus(options?: {
    signal?: AbortSignal;
  }): Promise<SystemStatusResponse> {
    const response = await httpClient.get<SystemStatusResponse>(
      "/system/status",
      {
        signal: options?.signal,
      },
    );
    return response.data;
  },
};
