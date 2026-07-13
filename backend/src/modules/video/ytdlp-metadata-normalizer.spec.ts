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
          protocol: undefined,
          hasUrl: false,
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
      entries: [],
    });
  });

  it('normalizes playlist entries with their own formats', () => {
    const metadata = normalizeYtDlpMetadata({
      _type: 'playlist',
      title: 'Tweet with multiple videos',
      entries: [
        {
          title: 'Tweet video #1',
          format_id: 'http-2176',
          formats: [
            {
              format_id: 'http-2176',
              ext: 'mp4',
              protocol: 'https',
              url: 'https://video.example/media.mp4',
              height: 1280,
              tbr: 2176,
              filesize_approx: 2_900_000,
            },
          ],
        },
      ],
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Tweet with multiple videos',
        formats: [],
        entries: [
          expect.objectContaining({
            title: 'Tweet video #1',
            formatId: 'http-2176',
            formats: [
              expect.objectContaining({
                formatId: 'http-2176',
                ext: 'mp4',
                protocol: 'https',
                hasUrl: true,
                height: 1280,
                tbr: 2176,
                filesizeApprox: 2_900_000,
              }),
            ],
          }),
        ],
      }),
    );
  });

  it('returns null for non-object metadata', () => {
    expect(normalizeYtDlpMetadata(null)).toBeNull();
    expect(normalizeYtDlpMetadata('invalid')).toBeNull();
  });
});
