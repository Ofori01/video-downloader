import type {
  AvailableProfile,
  JobViewModel,
  VideoFile,
  VideoJobCreateRequest,
  VideoJobCreateResponse,
} from "@/types";

export function normalizeSourceUrl(url: string): string {
  return url.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

export function isValidSourceUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function shouldPollJobStatus(status: string | undefined): boolean {
  return status === "queued" || status === "processing";
}

export function toOptimisticVideoFile(
  data: VideoJobCreateResponse,
  variables: VideoJobCreateRequest,
): VideoFile {
  return {
    id: data.fileId,
    key: `pending/${data.fileId}`,
    sourceUrl: variables.url,
    size: String(data.estimatedSize),
    status: data.status,
    sessionId: "current-session",
    profileId: variables.profileId ?? null,
    createdAt: new Date().toISOString(),
    downloadedAt: null,
    expiresAt: null,
    queueJobId: data.jobId,
    errorReason: null,
  };
}

export function toJobViewModel(file: VideoFile): JobViewModel {
  return {
    id: file.id,
    title: toTitle(file.sourceUrl),
    status: file.status,
    eta: formatEta(file),
    createdAt: file.createdAt,
    errorReason: file.errorReason,
  };
}

export function sortProfilesForSelection(
  profiles: AvailableProfile[],
): AvailableProfile[] {
  const merged = profiles.filter(
    (profile) => !profile.isAudioOnly && profile.audioCodec !== undefined,
  );
  const videoOnly = profiles.filter(
    (profile) => !profile.isAudioOnly && profile.audioCodec === undefined,
  );
  const audioOnly = profiles.filter((profile) => profile.isAudioOnly);

  return [
    ...merged.sort(compareProfileResolutionDescending),
    ...videoOnly.sort(compareProfileResolutionDescending),
    ...audioOnly,
  ];
}

function compareProfileResolutionDescending(
  a: AvailableProfile,
  b: AvailableProfile,
): number {
  return parseResolution(b.resolution) - parseResolution(a.resolution);
}

function parseResolution(resolution: string | undefined): number {
  return Number.parseInt(resolution ?? "0", 10) || 0;
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
