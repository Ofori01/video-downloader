import { normalizeYtDlpMetadata } from './ytdlp-metadata-normalizer';

describe('normalizeYtDlpMetadata', () => {
  it('normalizes yt-dlp snake_case metadata into internal camelCase fields', () => {
    const metadata = normalizeYtDlpMetadata({
      title: 'Example',
      format_id: 18,
      height: 1080,
      duration: '120',
      filesize_approx: '1000',
      requested_downloads: [{ filesize_approx: 900 }],
      formats: [
        {
          format_id: '18',
          ext: 'mp4',
          height: '720',
          vcodec: 'h264',
          acodec: 'aac',
          tbr: '1200',
          filesize_approx: '500',
        },
      ],
    });

    expect(metadata).toEqual({
      title: 'Example',
      formatId: '18',
      height: 1080,
      duration: 120,
      filesize: undefined,
      filesizeApprox: 1000,
      requestedDownloads: [{ filesize: undefined, filesizeApprox: 900 }],
      formats: [
        {
          formatId: '18',
          ext: 'mp4',
          height: 720,
          vcodec: 'h264',
          acodec: 'aac',
          tbr: 1200,
          abr: undefined,
          vbr: undefined,
          duration: undefined,
          filesize: undefined,
          filesizeApprox: 500,
        },
      ],
    });
  });

  it('returns null for non-object metadata', () => {
    expect(normalizeYtDlpMetadata(null)).toBeNull();
    expect(normalizeYtDlpMetadata('invalid')).toBeNull();
  });
});
