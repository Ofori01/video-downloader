export type FileStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "deleted";

export interface AvailableProfile {
  id: string;
  label: string;
  format: string;
  ext: string;
  contentType: string;
  mediaKind: "audio" | "video";
  resolution?: string;
  codec?: string;
  audioCodec?: string;
  estimatedSize?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  isAudioOnly: boolean;
}

export interface VideoJobCreateRequest {
  url: string;
  profileId?: string;
}

export interface VideoJobCreateResponse {
  fileId: string;
  jobId: string | null;
  estimatedSize: number;
  status: FileStatus;
}

export interface VideoFile {
  id: string;
  key: string;
  sourceUrl: string;
  size: string | null;
  status: FileStatus;
  sessionId: string;
  profileId: string | null;
  mediaKind: "audio" | "video" | null;
  outputExtension: string | null;
  contentType: string | null;
  createdAt: string;
  downloadedAt: string | null;
  expiresAt: string | null;
  queueJobId: string | null;
  errorReason: string | null;
}

export interface VideoDownloadUrlResponse {
  url: string;
}

export interface JobViewModel {
  id: string;
  title: string;
  status: FileStatus;
  eta: string;
  createdAt: string;
  errorReason: string | null;
}
