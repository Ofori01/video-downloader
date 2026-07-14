import { httpClient } from "@/api/http-client";
import type {
  AvailableProfile,
  VideoDownloadUrlResponse,
  VideoFile,
  VideoJobCreateRequest,
  VideoJobCreateResponse,
} from "@/types";

export const videoApi = {
  async getProfiles(
    url: string,
    options?: { signal?: AbortSignal },
  ): Promise<AvailableProfile[]> {
    const response = await httpClient.get<AvailableProfile[]>(
      `/video/profiles?url=${encodeURIComponent(url)}`,
      { signal: options?.signal },
    );
    return response.data;
  },

  async createJob(
    payload: VideoJobCreateRequest,
    options?: { signal?: AbortSignal },
  ): Promise<VideoJobCreateResponse> {
    const response = await httpClient.post<VideoJobCreateResponse>(
      "/video/jobs",
      payload,
      { signal: options?.signal },
    );
    return response.data;
  },

  async getFileStatus(
    fileId: string,
    options?: { signal?: AbortSignal },
  ): Promise<VideoFile> {
    const response = await httpClient.get<VideoFile>(`/video/files/${fileId}`, {
      signal: options?.signal,
    });
    return response.data;
  },

  async getSignedDownloadUrl(fileId: string): Promise<string> {
    const response = await httpClient.get<VideoDownloadUrlResponse>(
      `/video/files/${fileId}/download-url`,
    );
    return response.data.url;
  },
};
