export interface DownloadVideoJobData {
  fileId: string;
  url: string;
  sessionId: string;
  reservedBytes: number;
  profileId?: string;
}
