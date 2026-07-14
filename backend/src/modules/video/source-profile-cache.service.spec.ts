import { SourceProfileCacheService } from './source-profile-cache.service';
import type { AvailableProfile } from './ytdlp.types';

describe('SourceProfileCacheService', () => {
  const config = {
    sourceProfileCacheTtlSeconds: 600,
  };

  const redis = {
    raw: {
      get: jest.fn(),
      set: jest.fn(),
    },
  };

  const sourceDetector = {
    detect: jest.fn(),
  };

  const profiles: AvailableProfile[] = [
    {
      id: 'video+audio',
      label: '1080p with audio',
      format: 'video+audio',
      ext: 'mp4',
      contentType: 'video/mp4',
      mediaKind: 'video',
      estimatedSize: 1000,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
    },
  ];

  const createService = () =>
    new SourceProfileCacheService(
      config as never,
      redis as never,
      sourceDetector as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    sourceDetector.detect.mockReturnValue('instagram');
  });

  it('stores profiles by source and url digest with ttl', async () => {
    const service = createService();

    await service.saveProfiles('https://instagram.com/reel/a', profiles);

    expect(redis.raw.set).toHaveBeenCalledWith(
      expect.stringMatching(/^source:profiles:instagram:[a-f0-9]{64}$/),
      JSON.stringify({ profiles }),
      'EX',
      600,
    );
  });

  it('loads cached profiles', async () => {
    const service = createService();
    redis.raw.get.mockResolvedValue(JSON.stringify({ profiles }));

    await expect(
      service.getProfiles('https://instagram.com/reel/a'),
    ).resolves.toEqual(profiles);
  });

  it('returns null for cache miss or invalid payload', async () => {
    const service = createService();
    redis.raw.get.mockResolvedValueOnce(null);

    await expect(
      service.getProfiles('https://instagram.com/reel/a'),
    ).resolves.toBeNull();

    redis.raw.get.mockResolvedValueOnce('not-json');

    await expect(
      service.getProfiles('https://instagram.com/reel/a'),
    ).resolves.toBeNull();
  });
});
