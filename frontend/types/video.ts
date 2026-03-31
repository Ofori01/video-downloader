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
  resolution?: string;
  codec?: string;
  audioCodec?: string;
  estimatedSize?: number;
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
  createdAt: string;
  downloadedAt: string | null;
  expiresAt: string | null;
  queueJobId: string | null;
  errorReason: string | null;
}

export interface JobViewModel {
  id: string;
  title: string;
  status: FileStatus;
  eta: string;
  createdAt: string;
  errorReason: string | null;
}
