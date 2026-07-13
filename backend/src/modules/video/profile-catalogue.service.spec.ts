import { ProfileCatalogueService } from './profile-catalogue.service';
import { YtDlpMetadata } from './ytdlp.types';

describe('ProfileCatalogueService', () => {
  const metadataClient = {
    getMetadata: jest.fn(),
  };

  const formatSize = {
    getActualFormatSize: jest.fn(),
  };

  const createService = () =>
    new ProfileCatalogueService(formatSize as never, metadataClient as never);

  beforeEach(() => {
    jest.clearAllMocks();
    formatSize.getActualFormatSize.mockReturnValue(1000);
  });

  it('returns an empty catalogue when metadata has no formats', async () => {
    const service = createService();
    metadataClient.getMetadata.mockResolvedValue({
      title: 'No Formats',
      requestedDownloads: [],
      formats: [],
    });

    await expect(
      service.getAvailableProfiles('https://example.com/video'),
    ).resolves.toEqual([]);
  });

  it('builds profiles from the first playable playlist entry', async () => {
    const service = createService();
    metadataClient.getMetadata.mockResolvedValue({
      title: 'Tweet with multiple videos',
      requestedDownloads: [],
      formats: [],
      entries: [
        {
          title: 'Tweet video #1',
          formatId: 'http-2176',
          requestedDownloads: [],
          formats: [
            {
              formatId: 'http-2176',
              ext: 'mp4',
              protocol: 'https',
              hasUrl: true,
              height: 1280,
              tbr: 2176,
              filesizeApprox: 2_900_000,
            },
          ],
        },
      ],
    });

    await expect(
      service.getAvailableProfiles('https://x.com/example/status/123/video/1'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'http-2176',
        label: '1280p · MP4',
        ext: 'mp4',
        contentType: 'video/mp4',
        mediaKind: 'video',
        resolution: '1280p',
        hasAudio: true,
        hasVideo: true,
        isAudioOnly: false,
      }),
    ]);
  });

  it('treats direct HTTP MP4 formats without codec fields as muxed video', async () => {
    const service = createService();
    metadataClient.getMetadata.mockResolvedValue({
      title: 'Tweet video',
      formatId: 'http-2176',
      requestedDownloads: [],
      formats: [
        {
          formatId: 'http-2176',
          ext: 'mp4',
          protocol: 'https',
          hasUrl: true,
          height: 1024,
          tbr: 2176,
          filesizeApprox: 35_854_224,
        },
      ],
    });

    await expect(
      service.getAvailableProfiles('https://x.com/example/status/123'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'http-2176',
        label: '1024p · MP4',
        ext: 'mp4',
        contentType: 'video/mp4',
        mediaKind: 'video',
        resolution: '1024p',
        codec: undefined,
        audioCodec: undefined,
        hasAudio: true,
        hasVideo: true,
        isAudioOnly: false,
      }),
    ]);
  });

  it('builds best, quality tier, and audio-only profiles', async () => {
    const service = createService();
    const metadata: YtDlpMetadata = {
      title: 'Example',
      formatId: 'best',
      height: 1080,
      duration: 120,
      requestedDownloads: [],
      formats: [
        {
          formatId: 'best',
          ext: 'mp4',
          height: 1080,
          vcodec: 'h264',
          acodec: 'aac',
          filesize: 2000,
        },
        {
          formatId: '720-av',
          ext: 'mp4',
          height: 720,
          vcodec: 'h264',
          acodec: 'aac',
          tbr: 1200,
        },
        {
          formatId: '720-v',
          ext: 'mp4',
          height: 720,
          vcodec: 'h264',
          acodec: 'none',
          tbr: 1400,
        },
        {
          formatId: 'audio',
          ext: 'm4a',
          vcodec: 'none',
          acodec: 'aac',
          abr: 160,
        },
      ],
    };
    metadataClient.getMetadata.mockResolvedValue(metadata);

    const profiles = await service.getAvailableProfiles(
      'https://example.com/video',
    );

    expect(profiles).toEqual([
      expect.objectContaining({
        id: 'best',
        label: '1080p · H.264 · AAC · MP4',
        ext: 'mp4',
        contentType: 'video/mp4',
        mediaKind: 'video',
        resolution: '1080p',
        hasAudio: true,
        hasVideo: true,
        isAudioOnly: false,
      }),
      expect.objectContaining({
        id: '720-v+audio',
        label: '720p with audio',
        ext: 'mp4',
        contentType: 'video/mp4',
        mediaKind: 'video',
        resolution: '720p',
        hasAudio: true,
        hasVideo: true,
        isAudioOnly: false,
      }),
      expect.objectContaining({
        id: 'audio',
        label: 'Audio only (m4a)',
        ext: 'm4a',
        contentType: 'audio/mp4',
        mediaKind: 'audio',
        hasAudio: true,
        hasVideo: false,
        isAudioOnly: true,
      }),
    ]);
    expect(profiles).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '720-v',
        }),
      ]),
    );
  });

  it('builds merged MP4 profiles from split Instagram-style video and audio streams', async () => {
    const service = createService();
    metadataClient.getMetadata.mockResolvedValue({
      title: 'Instagram reel',
      formatId: '3',
      duration: 80,
      requestedDownloads: [],
      formats: [
        {
          formatId: 'dash-audio',
          ext: 'm4a',
          protocol: 'https',
          hasUrl: true,
          vcodec: 'none',
          acodec: 'mp4a.40.5',
          abr: 69,
        },
        {
          formatId: '3',
          ext: 'mp4',
          protocol: 'https',
          hasUrl: true,
        },
        {
          formatId: 'dash-720v',
          ext: 'mp4',
          protocol: 'https',
          hasUrl: true,
          height: 1280,
          vcodec: 'vp09.00.31.08.00.01.01.01.00',
          acodec: 'none',
          tbr: 470,
        },
        {
          formatId: 'dash-1080v',
          ext: 'mp4',
          protocol: 'https',
          hasUrl: true,
          height: 1920,
          vcodec: 'vp09.00.40.08.00.01.01.01.00',
          acodec: 'none',
          tbr: 789,
        },
      ],
    });

    await expect(
      service.getAvailableProfiles('https://www.instagram.com/reel/example'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'dash-1080v+dash-audio',
        format: 'dash-1080v+dash-audio',
        label: '1920p with audio',
        ext: 'mp4',
        contentType: 'video/mp4',
        mediaKind: 'video',
        resolution: '1920p',
        hasAudio: true,
        hasVideo: true,
        isAudioOnly: false,
      }),
      expect.objectContaining({
        id: 'dash-720v+dash-audio',
        format: 'dash-720v+dash-audio',
        label: '1280p with audio',
        ext: 'mp4',
        contentType: 'video/mp4',
        mediaKind: 'video',
        resolution: '1280p',
        hasAudio: true,
        hasVideo: true,
        isAudioOnly: false,
      }),
      expect.objectContaining({
        id: 'dash-audio',
        label: 'Audio only (m4a)',
        ext: 'm4a',
        contentType: 'audio/mp4',
        mediaKind: 'audio',
        hasAudio: true,
        hasVideo: false,
        isAudioOnly: true,
      }),
    ]);
  });

  it('resolves a selected profile from the generated catalogue', async () => {
    const service = createService();
    metadataClient.getMetadata.mockResolvedValue({
      requestedDownloads: [],
      formats: [
        {
          formatId: 'audio',
          ext: 'm4a',
          vcodec: 'none',
          acodec: 'aac',
          filesize: 1234,
        },
      ],
    });

    await expect(
      service.getProfile('https://example.com/video', 'audio'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'audio',
        format: 'audio',
        ext: 'm4a',
        contentType: 'audio/mp4',
        mediaKind: 'audio',
      }),
    );
  });

  it('does not resolve video-only formats as selectable profiles', async () => {
    const service = createService();
    metadataClient.getMetadata.mockResolvedValue({
      requestedDownloads: [],
      formats: [
        {
          formatId: 'video-only',
          ext: 'mp4',
          height: 720,
          vcodec: 'h264',
          acodec: 'none',
          filesize: 1234,
        },
      ],
    });

    await expect(
      service.getProfile('https://example.com/video', 'video-only'),
    ).resolves.toBeNull();
  });

  it('returns selected format size from metadata', async () => {
    const service = createService();
    const metadata: YtDlpMetadata = {
      requestedDownloads: [],
      formats: [{ formatId: '18', filesize: 1234 }],
    };
    metadataClient.getMetadata.mockResolvedValue(metadata);
    formatSize.getActualFormatSize.mockReturnValue(1234);

    await expect(
      service.getFormatSize('https://example.com/video', '18'),
    ).resolves.toBe(1234);

    expect(formatSize.getActualFormatSize).toHaveBeenCalledWith(
      metadata.formats[0],
      metadata,
    );
  });
});
