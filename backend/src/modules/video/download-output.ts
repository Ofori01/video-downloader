import { formatHasVideo } from './ytdlp-format-capabilities';

export type DownloadMediaKind = 'audio' | 'video';

export interface DownloadOutput {
  mediaKind: DownloadMediaKind;
  extension: string;
  contentType: string;
}

interface MediaFormatProbe {
  ext?: string;
  protocol?: string;
  hasUrl?: boolean;
  height?: number;
  vcodec?: string;
  acodec?: string;
}

const DEFAULT_EXTENSION = 'mp4';

export const DEFAULT_VIDEO_OUTPUT: DownloadOutput = {
  mediaKind: 'video',
  extension: DEFAULT_EXTENSION,
  contentType: 'video/mp4',
};

const CONTENT_TYPE_BY_EXTENSION: Record<
  DownloadMediaKind,
  Record<string, string>
> = {
  audio: {
    aac: 'audio/aac',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    oga: 'audio/ogg',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    wav: 'audio/wav',
    webm: 'audio/webm',
  },
  video: {
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    mp4: 'video/mp4',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    ogv: 'video/ogg',
    webm: 'video/webm',
  },
};

export function inferDownloadOutput(format: MediaFormatProbe): DownloadOutput {
  const mediaKind = formatHasVideo(format) ? 'video' : 'audio';
  const extension = normalizeExtension(format.ext);

  return {
    mediaKind,
    extension,
    contentType: contentTypeFor(mediaKind, extension),
  };
}

export function coerceDownloadOutput(
  output: Partial<DownloadOutput> | null | undefined,
): DownloadOutput {
  if (!output) {
    return DEFAULT_VIDEO_OUTPUT;
  }

  const mediaKind = output.mediaKind === 'audio' ? 'audio' : 'video';
  const extension = normalizeExtension(output.extension);

  return {
    mediaKind,
    extension,
    contentType:
      normalizeContentType(output.contentType) ??
      contentTypeFor(mediaKind, extension),
  };
}

export function buildDownloadObjectKey(
  fileId: string,
  output: DownloadOutput,
): string {
  const extension = normalizeExtension(output.extension);
  const directory = output.mediaKind === 'audio' ? 'audio' : 'videos';
  return `${directory}/${fileId}.${extension}`;
}

function contentTypeFor(
  mediaKind: DownloadMediaKind,
  extension: string,
): string {
  return (
    CONTENT_TYPE_BY_EXTENSION[mediaKind][extension] ??
    'application/octet-stream'
  );
}

function normalizeExtension(extension: string | undefined): string {
  const normalized = extension
    ?.toLowerCase()
    .replace(/^\./, '')
    .replace(/[^a-z0-9]/g, '');

  return normalized || DEFAULT_EXTENSION;
}

function normalizeContentType(contentType: string | undefined): string | null {
  const normalized = contentType?.trim().toLowerCase();
  return normalized && normalized.includes('/') ? normalized : null;
}
