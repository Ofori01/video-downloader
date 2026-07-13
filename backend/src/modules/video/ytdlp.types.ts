import type { DownloadMediaKind } from './download-output';

export type YtDlpStreamProfile = 'default' | 'fallback' | 'custom';

export interface YtDlpStreamDiagnostics {
  command?: string;
  stderrTail: string[];
  lastProgress?: string;
  profile: YtDlpStreamProfile;
}

export interface AvailableProfile {
  id: string;
  label: string;
  format: string;
  ext: string;
  contentType: string;
  mediaKind: DownloadMediaKind;
  resolution?: string;
  codec?: string;
  audioCodec?: string;
  estimatedSize?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  isAudioOnly: boolean;
}

export interface YtDlpRequestedDownload {
  filesize?: number;
  filesizeApprox?: number;
}

export interface YtDlpFormat {
  formatId?: string;
  ext?: string;
  protocol?: string;
  hasUrl?: boolean;
  height?: number;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  abr?: number;
  vbr?: number;
  duration?: number;
  filesize?: number;
  filesizeApprox?: number;
}

export interface YtDlpMetadata {
  title?: string;
  formatId?: string;
  height?: number;
  duration?: number;
  filesize?: number;
  filesizeApprox?: number;
  requestedDownloads: YtDlpRequestedDownload[];
  formats: YtDlpFormat[];
  entries?: YtDlpMetadata[];
}
