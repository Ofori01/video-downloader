import { SourceCooldownService } from './source-cooldown.service';
import type { YtDlpFailureClassification } from './ytdlp-error-classifier.service';

describe('SourceCooldownService', () => {
  const config = {
    instagramCooldownSeconds: 1800,
  };

  const redis = {
    raw: {
      exists: jest.fn(),
      set: jest.fn(),
    },
  };

  const sourceDetector = {
    detect: jest.fn(),
  };

  const createService = () =>
    new SourceCooldownService(
      config as never,
      redis as never,
      sourceDetector as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports active Instagram cooldown from Redis', async () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('instagram');
    redis.raw.exists.mockResolvedValue(1);

    await expect(
      service.getStatus('https://instagram.com/reel/a'),
    ).resolves.toEqual({
      source: 'instagram',
      active: true,
    });

    expect(redis.raw.exists).toHaveBeenCalledWith('source:cooldown:instagram');
  });

  it('does not use Redis cooldown for generic sources', async () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('generic');

    await expect(service.getStatus('https://example.com')).resolves.toEqual({
      source: 'generic',
      active: false,
    });

    expect(redis.raw.exists).not.toHaveBeenCalled();
  });

  it('records Instagram rate-limit failures with ttl', async () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('instagram');
    const failure: YtDlpFailureClassification = {
      code: 'source_rate_limited',
      retryable: false,
      userMessage: 'Server busy. Try again later.',
    };

    await service.recordFailure('https://instagram.com/reel/a', failure);

    expect(redis.raw.set).toHaveBeenCalledWith(
      'source:cooldown:instagram',
      'source_rate_limited',
      'EX',
      1800,
    );
  });

  it('ignores non-rate-limit failures', async () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('instagram');

    await service.recordFailure('https://instagram.com/reel/a', {
      code: 'source_download_failed',
      retryable: true,
      userMessage: 'Server busy. Try again later.',
    });

    expect(redis.raw.set).not.toHaveBeenCalled();
  });
});
