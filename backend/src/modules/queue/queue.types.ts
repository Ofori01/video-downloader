import type { DownloadOutput } from '../video/download-output';
import type { YtDlpMetadata } from '../video/ytdlp.types';

export interface DownloadVideoJobData {
  fileId: string;
  url: string;
  sessionId: string;
  reservedBytes: number;
  profileId?: string;
  output: DownloadOutput;
}

export interface ExtractMetadataJobData {
  url: string;
}

export interface ExtractMetadataJobResult {
  metadata: YtDlpMetadata | null;
}

export type VideoQueueJobData = DownloadVideoJobData | ExtractMetadataJobData;
