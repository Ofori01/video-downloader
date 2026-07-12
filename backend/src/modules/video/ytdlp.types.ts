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
  resolution?: string;
  codec?: string;
  audioCodec?: string;
  estimatedSize?: number;
  isAudioOnly: boolean;
}

export interface YtDlpRequestedDownload {
  filesize?: number;
  filesizeApprox?: number;
}

export interface YtDlpFormat {
  formatId?: string;
  ext?: string;
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
}
