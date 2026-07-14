import { YtDlpErrorClassifierService } from './ytdlp-error-classifier.service';

describe('YtDlpErrorClassifierService', () => {
  const createService = () => new YtDlpErrorClassifierService();

  it('classifies rate limiting as non-retryable with a generic user message', () => {
    const service = createService();

    expect(
      service.classify({
        stderrTail: [
          'ERROR: [Instagram] abc: Unable to download webpage: HTTP Error 429: Too Many Requests',
        ],
      }),
    ).toEqual({
      code: 'source_rate_limited',
      retryable: false,
      userMessage: 'Server busy. Try again later.',
    });
  });

  it('classifies auth-gated source errors without exposing details', () => {
    const service = createService();

    expect(
      service.classify({
        stderrTail: ['ERROR: This video requires login cookies'],
      }),
    ).toEqual({
      code: 'source_auth_required',
      retryable: false,
      userMessage: 'Server busy. Try again later.',
    });
  });

  it('classifies unavailable source errors without exposing details', () => {
    const service = createService();

    expect(
      service.classify({
        stderrTail: ['ERROR: This video is unavailable'],
      }),
    ).toEqual({
      code: 'source_unavailable',
      retryable: false,
      userMessage: 'Server busy. Try again later.',
    });
  });

  it('defaults unknown yt-dlp errors to retryable source failures', () => {
    const service = createService();

    expect(
      service.classify({
        stderrTail: [],
        error: new Error('yt-dlp process exited (code=1 signal=none)'),
      }),
    ).toEqual({
      code: 'source_download_failed',
      retryable: true,
      userMessage: 'Server busy. Try again later.',
    });
  });
});
