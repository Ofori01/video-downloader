import {
  YtDlpFormat,
  YtDlpMetadata,
  YtDlpRequestedDownload,
} from './ytdlp.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeRequestedDownload = (
  value: unknown,
): YtDlpRequestedDownload | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    filesize: asOptionalNumber(value.filesize),
    filesizeApprox: asOptionalNumber(value.filesize_approx),
  };
};

const normalizeFormat = (value: unknown): YtDlpFormat | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    formatId: asOptionalString(value.format_id),
    ext: asOptionalString(value.ext),
    protocol: asOptionalString(value.protocol),
    hasUrl: typeof value.url === 'string' && value.url.length > 0,
    height: asOptionalNumber(value.height),
    vcodec: asOptionalString(value.vcodec),
    acodec: asOptionalString(value.acodec),
    tbr: asOptionalNumber(value.tbr),
    abr: asOptionalNumber(value.abr),
    vbr: asOptionalNumber(value.vbr),
    duration: asOptionalNumber(value.duration),
    filesize: asOptionalNumber(value.filesize),
    filesizeApprox: asOptionalNumber(value.filesize_approx),
  };
};

export const normalizeYtDlpMetadata = (
  value: unknown,
): YtDlpMetadata | null => {
  if (!isRecord(value)) {
    return null;
  }

  const requestedDownloads = Array.isArray(value.requested_downloads)
    ? value.requested_downloads
        .map(normalizeRequestedDownload)
        .filter((item): item is YtDlpRequestedDownload => item !== null)
    : [];

  const formats = Array.isArray(value.formats)
    ? value.formats
        .map(normalizeFormat)
        .filter((item): item is YtDlpFormat => item !== null)
    : [];

  const entries = Array.isArray(value.entries)
    ? value.entries
        .map(normalizeYtDlpMetadata)
        .filter((item): item is YtDlpMetadata => item !== null)
    : [];

  return {
    title: asOptionalString(value.title),
    formatId: asOptionalString(value.format_id),
    height: asOptionalNumber(value.height),
    duration: asOptionalNumber(value.duration),
    filesize: asOptionalNumber(value.filesize),
    filesizeApprox: asOptionalNumber(value.filesize_approx),
    requestedDownloads,
    formats,
    entries,
  };
};
