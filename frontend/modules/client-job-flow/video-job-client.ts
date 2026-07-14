import { videoApi } from "@/api/video.api";
import type {
  AvailableProfile,
  VideoFile,
  VideoJobCreateRequest,
  VideoJobCreateResponse,
} from "@/types";
import { normalizeSourceUrl } from "./job-flow-model";

const createJobInFlightByRequest = new Map<
  string,
  Promise<VideoJobCreateResponse>
>();
let activeCreateController: AbortController | null = null;

export const videoJobClient = {
  getProfiles(
    url: string,
    options?: { signal?: AbortSignal },
  ): Promise<AvailableProfile[]> {
    return videoApi.getProfiles(url, options);
  },

  createJob(payload: VideoJobCreateRequest): Promise<VideoJobCreateResponse> {
    const normalizedUrl = normalizeSourceUrl(payload.url);
    const normalizedPayload: VideoJobCreateRequest = {
      url: normalizedUrl,
      profileId: payload.profileId,
    };
    const requestKey = `${normalizedPayload.url}::${normalizedPayload.profileId ?? "default"}`;
    const inFlight = createJobInFlightByRequest.get(requestKey);
    if (inFlight) {
      return inFlight;
    }

    if (activeCreateController) {
      activeCreateController.abort();
    }

    const controller = new AbortController();
    activeCreateController = controller;

    const requestPromise = videoApi
      .createJob(normalizedPayload, { signal: controller.signal })
      .finally(() => {
        createJobInFlightByRequest.delete(requestKey);
        if (activeCreateController === controller) {
          activeCreateController = null;
        }
      });

    createJobInFlightByRequest.set(requestKey, requestPromise);
    return requestPromise;
  },

  getFileStatus(
    fileId: string,
    options?: { signal?: AbortSignal },
  ): Promise<VideoFile> {
    return videoApi.getFileStatus(fileId, options);
  },

  getSignedDownloadUrl(fileId: string): Promise<string> {
    return videoApi.getSignedDownloadUrl(fileId);
  },
};
