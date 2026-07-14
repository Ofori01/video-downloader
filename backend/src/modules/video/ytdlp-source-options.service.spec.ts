import { YtDlpSourceOptionsService } from './ytdlp-source-options.service';

describe('YtDlpSourceOptionsService', () => {
  const config = {
    instagramYtDlpSleepRequestsSeconds: 1.5,
    instagramYtDlpRetrySleep: 'extractor:exp=30:300',
  };

  const sourceDetector = {
    detect: jest.fn(),
  };

  const createService = () =>
    new YtDlpSourceOptionsService(config as never, sourceDetector as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns pacing args for Instagram downloads', () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('instagram');

    expect(service.getDownloadArgs('https://instagram.com/reel/a')).toEqual([
      '--sleep-requests',
      '1.5',
      '--retry-sleep',
      'extractor:exp=30:300',
    ]);
  });

  it('returns metadata pacing options for Instagram', () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('instagram');

    expect(service.getMetadataOptions('https://instagram.com/reel/a')).toEqual({
      extractorRetries: 1,
      forceIpv4: true,
      retries: 1,
      retrySleep: 'extractor:exp=30:300',
      sleepRequests: 1.5,
    });
  });

  it('does not add options for generic sources', () => {
    const service = createService();
    sourceDetector.detect.mockReturnValue('generic');

    expect(service.getDownloadArgs('https://example.com/video')).toEqual([]);
    expect(service.getMetadataOptions('https://example.com/video')).toEqual({});
  });
});
