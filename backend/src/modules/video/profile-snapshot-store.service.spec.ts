import { ProfileSnapshotStoreService } from './profile-snapshot-store.service';
import type { AvailableProfile } from './ytdlp.types';

describe('ProfileSnapshotStoreService', () => {
  const config = {
    sessionWindowSeconds: 600,
  };

  const redis = {
    raw: {
      get: jest.fn(),
      set: jest.fn(),
    },
  };

  const profiles: AvailableProfile[] = [
    {
      id: 'video+audio',
      label: '1080p with audio',
      format: 'video+audio',
      ext: 'mp4',
      contentType: 'video/mp4',
      mediaKind: 'video',
      estimatedSize: 0,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
    },
    {
      id: 'audio',
      label: 'Audio only',
      format: 'audio-format',
      ext: 'm4a',
      contentType: 'audio/mp4',
      mediaKind: 'audio',
      estimatedSize: 1024,
      hasAudio: true,
      hasVideo: false,
      isAudioOnly: true,
    },
  ];

  const createService = () =>
    new ProfileSnapshotStoreService(config as never, redis as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves profiles with the configured session ttl', async () => {
    const service = createService();

    await service.saveProfiles(
      'session-1',
      'https://example.com/video',
      profiles,
    );

    expect(redis.raw.set).toHaveBeenCalledWith(
      expect.stringMatching(/^video:profile-snapshot:session-1:[a-f0-9]{64}$/),
      JSON.stringify({ profiles }),
      'EX',
      600,
    );
  });

  it('returns a profile by id or format from the saved snapshot', async () => {
    const service = createService();
    redis.raw.get.mockResolvedValue(JSON.stringify({ profiles }));

    await expect(
      service.getProfile(
        'session-1',
        'https://example.com/video',
        'video+audio',
      ),
    ).resolves.toEqual(profiles[0]);
    await expect(
      service.getProfile(
        'session-1',
        'https://example.com/video',
        'audio-format',
      ),
    ).resolves.toEqual(profiles[1]);
  });

  it('returns null when the snapshot is missing or invalid', async () => {
    const service = createService();
    redis.raw.get.mockResolvedValueOnce(null);

    await expect(
      service.getProfile(
        'session-1',
        'https://example.com/video',
        'video+audio',
      ),
    ).resolves.toBeNull();

    redis.raw.get.mockResolvedValueOnce('not-json');

    await expect(
      service.getProfile(
        'session-1',
        'https://example.com/video',
        'video+audio',
      ),
    ).resolves.toBeNull();
  });
});
