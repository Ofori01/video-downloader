import { SourceConcurrencyService } from './source-concurrency.service';

describe('SourceConcurrencyService', () => {
  const config = {
    instagramSourceLockTtlSeconds: 300,
  };

  const redis = {
    raw: {
      eval: jest.fn(),
      set: jest.fn(),
    },
  };

  const sourceDetector = {
    detect: jest.fn(),
  };

  const createService = () =>
    new SourceConcurrencyService(
      config as never,
      redis as never,
      sourceDetector as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('acquires and releases the Instagram slot', async () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('instagram');
    redis.raw.set.mockResolvedValue('OK');

    const slot = await service.acquireSlot('https://instagram.com/reel/a');

    expect(slot).toMatchObject({ source: 'instagram', acquired: true });
    expect(redis.raw.set).toHaveBeenCalledWith(
      'source:slot:instagram',
      expect.any(String),
      'EX',
      300,
      'NX',
    );

    await slot.release();

    expect(redis.raw.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('GET', KEYS[1])"),
      1,
      'source:slot:instagram',
      expect.any(String),
    );
  });

  it('returns an unacquired slot when Instagram is already locked', async () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('instagram');
    redis.raw.set.mockResolvedValue(null);

    const slot = await service.acquireSlot('https://instagram.com/reel/a');

    expect(slot).toMatchObject({ source: 'instagram', acquired: false });
    await slot.release();
    expect(redis.raw.eval).not.toHaveBeenCalled();
  });

  it('does not lock generic sources', async () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('generic');

    const slot = await service.acquireSlot('https://example.com/video');

    expect(slot).toMatchObject({ source: 'generic', acquired: true });
    expect(redis.raw.set).not.toHaveBeenCalled();
  });
});
