import { videoApi } from "@/api/video.api";
import type {
  JobViewModel,
  VideoJobCreateRequest,
  VideoJobCreateResponse,
  VideoFile,
} from "@/types";

const createJobInFlightByRequest = new Map<
  string,
  Promise<VideoJobCreateResponse>
>();
let activeCreateController: AbortController | null = null;

export function normalizeSourceUrl(url: string): string {
  // Remove zero-width characters often introduced by copy/paste and trim.
  return url.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function formatEta(file: VideoFile): string {
  if (file.status === "queued") {
    return "waiting for worker capacity";
  }

  if (file.status === "processing") {
    return "processing in progress";
  }

  if (file.status === "ready" && file.expiresAt) {
    const expiresAt = new Date(file.expiresAt).getTime();
    const now = Date.now();
    const remainingMs = Math.max(0, expiresAt - now);
    const remainingMinutes = Math.floor(remainingMs / 60000);
    return remainingMinutes > 0
      ? `expires in ${remainingMinutes} min`
      : "expires soon";
  }

  if (file.status === "failed") {
    return "processing failed";
  }

  return "status updated";
}

function toTitle(sourceUrl: string): string {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.replace("www.", "");
  } catch {
    return "Video job";
  }
}

export const videoService = {
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

  getDownloadUrl(fileId: string): string {
    return videoApi.getDownloadUrl(fileId);
  },

  toJobViewModel(file: VideoFile): JobViewModel {
    return {
      id: file.id,
      title: toTitle(file.sourceUrl),
      status: file.status,
      eta: formatEta(file),
      createdAt: file.createdAt,
      errorReason: file.errorReason,
    };
  },
};
