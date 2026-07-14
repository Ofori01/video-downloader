import { PassThrough } from 'node:stream';
import { DOWNLOAD_JOB_NAME, METADATA_JOB_NAME } from '../queue/queue.constants';
import { VideoProcessor } from './video.processor';
import type { YtDlpFailureClassification } from './ytdlp-error-classifier.service';

describe('VideoProcessor', () => {
  const storageService = {
    uploadStream: jest.fn(),
  };

  const downloadLifecycle = {
    markReady: jest.fn(),
    reconcileReservationForCompletedFile: jest.fn(),
    markFailed: jest.fn(),
    releaseReservation: jest.fn(),
  };

  const ytDlpErrorClassifier = {
    classify: jest.fn(),
  };

  const releaseSlot = jest.fn();
  const sourceConcurrency = {
    acquireSlot: jest.fn(),
  };

  const sourceCooldown = {
    getStatus: jest.fn(),
    recordFailure: jest.fn(),
  };

  const metadataClient = {
    getMetadata: jest.fn(),
  };

  const ytDlpStreamClient = {
    getDownloadStream: jest.fn(),
  };

  const createProcessor = () =>
    new VideoProcessor(
      storageService as never,
      downloadLifecycle as never,
      ytDlpErrorClassifier as never,
      sourceConcurrency as never,
      sourceCooldown as never,
      metadataClient as never,
      ytDlpStreamClient as never,
    );

  const createDownloadJob = (attemptsMade = 0) =>
    ({
      id: 'file-1',
      name: DOWNLOAD_JOB_NAME,
      attemptsMade,
      opts: { attempts: 2 },
      data: {
        fileId: 'file-1',
        url: 'https://example.com/video',
        sessionId: 'session-1',
        reservedBytes: 5000,
        profileId: 'video+audio',
        output: {
          mediaKind: 'video',
          extension: 'mp4',
          contentType: 'video/mp4',
        },
      },
    }) as never;

  const createMetadataJob = () =>
    ({
      id: 'metadata-1',
      name: METADATA_JOB_NAME,
      data: {
        url: 'https://instagram.com/reel/a',
      },
    }) as never;

  beforeEach(() => {
    jest.clearAllMocks();
    sourceConcurrency.acquireSlot.mockResolvedValue({
      source: 'generic',
      acquired: true,
      release: releaseSlot,
    });
    sourceCooldown.getStatus.mockResolvedValue({
      source: 'generic',
      active: false,
    });
  });

  it('marks the job failed when the source slot is unavailable', async () => {
    const processor = createProcessor();
    sourceConcurrency.acquireSlot.mockResolvedValue({
      source: 'instagram',
      acquired: false,
      release: releaseSlot,
    });

    await expect(
      processor.process(createDownloadJob()),
    ).resolves.toBeUndefined();

    expect(ytDlpStreamClient.getDownloadStream).not.toHaveBeenCalled();
    expect(downloadLifecycle.markFailed).toHaveBeenCalledWith(
      'file-1',
      'Server busy. Try again later.',
    );
    expect(downloadLifecycle.releaseReservation).toHaveBeenCalledWith(
      'session-1',
      5000,
    );
    expect(releaseSlot).not.toHaveBeenCalled();
  });

  it('rejects metadata extraction during an active source cooldown', async () => {
    const processor = createProcessor();
    sourceCooldown.getStatus.mockResolvedValue({
      source: 'instagram',
      active: true,
    });

    await expect(processor.process(createMetadataJob())).rejects.toThrow(
      'Server busy. Try again later.',
    );

    expect(sourceConcurrency.acquireSlot).not.toHaveBeenCalled();
    expect(metadataClient.getMetadata).not.toHaveBeenCalled();
  });

  it('records metadata rate-limit failures and returns a source rejection', async () => {
    const processor = createProcessor();
    const error = new Error('HTTP Error 429: Too Many Requests');
    const classification: YtDlpFailureClassification = {
      code: 'source_rate_limited',
      retryable: false,
      userMessage: 'Server busy. Try again later.',
    };
    metadataClient.getMetadata.mockRejectedValue(error);
    ytDlpErrorClassifier.classify.mockReturnValue(classification);

    await expect(processor.process(createMetadataJob())).rejects.toThrow(
      'Server busy. Try again later.',
    );

    expect(sourceCooldown.recordFailure).toHaveBeenCalledWith(
      'https://instagram.com/reel/a',
      classification,
    );
    expect(releaseSlot).toHaveBeenCalled();
  });

  it('marks non-retryable yt-dlp source failures with a generic user message', async () => {
    const processor = createProcessor();
    const stream = new PassThrough();
    const streamError = new Error('yt-dlp process exited (code=1 signal=none)');
    const classification: YtDlpFailureClassification = {
      code: 'source_rate_limited',
      retryable: false,
      userMessage: 'Server busy. Try again later.',
    };

    ytDlpStreamClient.getDownloadStream.mockReturnValue({
      stream,
      diagnostics: {
        profile: 'custom',
        stderrTail: ['HTTP Error 429: Too Many Requests'],
      },
    });
    ytDlpErrorClassifier.classify.mockReturnValue(classification);
    storageService.uploadStream.mockImplementation(
      (_key: string, sourceStream: PassThrough) => {
        sourceStream.emit('error', streamError);
        return Promise.reject(streamError);
      },
    );

    await expect(
      processor.process(createDownloadJob()),
    ).resolves.toBeUndefined();

    expect(ytDlpErrorClassifier.classify).toHaveBeenCalledWith({
      stderrTail: ['HTTP Error 429: Too Many Requests'],
      error: streamError,
    });
    expect(sourceCooldown.recordFailure).toHaveBeenCalledWith(
      'https://example.com/video',
      classification,
    );
    expect(downloadLifecycle.markFailed).toHaveBeenCalledWith(
      'file-1',
      'Server busy. Try again later.',
    );
    expect(downloadLifecycle.releaseReservation).toHaveBeenCalledWith(
      'session-1',
      5000,
    );
    expect(downloadLifecycle.markReady).not.toHaveBeenCalled();
    expect(releaseSlot).toHaveBeenCalled();
  });

  it('keeps retryable yt-dlp source failures retryable before the final attempt', async () => {
    const processor = createProcessor();
    const stream = new PassThrough();
    const streamError = new Error('yt-dlp process exited (code=1 signal=none)');
    const classification: YtDlpFailureClassification = {
      code: 'source_download_failed',
      retryable: true,
      userMessage: 'Server busy. Try again later.',
    };

    ytDlpStreamClient.getDownloadStream.mockReturnValue({
      stream,
      diagnostics: {
        profile: 'custom',
        stderrTail: ['ERROR: temporary source failure'],
      },
    });
    ytDlpErrorClassifier.classify.mockReturnValue(classification);
    storageService.uploadStream.mockImplementation(
      (_key: string, sourceStream: PassThrough) => {
        sourceStream.emit('error', streamError);
        return Promise.reject(streamError);
      },
    );

    await expect(processor.process(createDownloadJob())).rejects.toThrow(
      streamError,
    );

    expect(downloadLifecycle.markFailed).not.toHaveBeenCalled();
    expect(downloadLifecycle.releaseReservation).not.toHaveBeenCalled();
  });

  it('marks retryable yt-dlp source failures with a generic message on the final attempt', async () => {
    const processor = createProcessor();
    const stream = new PassThrough();
    const streamError = new Error('yt-dlp process exited (code=1 signal=none)');
    const classification: YtDlpFailureClassification = {
      code: 'source_download_failed',
      retryable: true,
      userMessage: 'Server busy. Try again later.',
    };

    ytDlpStreamClient.getDownloadStream.mockReturnValue({
      stream,
      diagnostics: {
        profile: 'custom',
        stderrTail: ['ERROR: temporary source failure'],
      },
    });
    ytDlpErrorClassifier.classify.mockReturnValue(classification);
    storageService.uploadStream.mockImplementation(
      (_key: string, sourceStream: PassThrough) => {
        sourceStream.emit('error', streamError);
        return Promise.reject(streamError);
      },
    );

    await expect(processor.process(createDownloadJob(1))).rejects.toThrow(
      streamError,
    );

    expect(downloadLifecycle.markFailed).toHaveBeenCalledWith(
      'file-1',
      'Server busy. Try again later.',
    );
    expect(downloadLifecycle.releaseReservation).toHaveBeenCalledWith(
      'session-1',
      5000,
    );
  });
});
