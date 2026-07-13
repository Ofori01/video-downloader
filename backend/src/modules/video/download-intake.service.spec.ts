import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FileStatus } from '../../entities/file.entity';
import { DownloadIntakeService } from './download-intake.service';

describe('DownloadIntakeService', () => {
  const config = {
    enableNewRequests: true,
    sessionMaxJobs: 5,
  };

  const fileStore = {
    createQueuedDownload: jest.fn(),
    createProcessingDownload: jest.fn(),
    attachQueueJob: jest.fn(),
    markFailed: jest.fn(),
  };

  const profileCatalogue = {
    getProfile: jest.fn(),
  };

  const queueProducer = {
    enqueueDownloadJob: jest.fn(),
  };

  const reservationService = {
    evaluateAdmission: jest.fn(),
    reserve: jest.fn(),
    release: jest.fn(),
  };

  const sessionService = {
    incrementSessionJobs: jest.fn(),
  };

  const sizeEstimator = {
    estimate: jest.fn(),
  };

  const createService = () =>
    new DownloadIntakeService(
      config as never,
      fileStore as never,
      profileCatalogue as never,
      queueProducer as never,
      reservationService as never,
      sessionService as never,
      sizeEstimator as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    config.enableNewRequests = true;
    sessionService.incrementSessionJobs.mockResolvedValue(1);
    sizeEstimator.estimate.mockResolvedValue(1000);
    profileCatalogue.getProfile.mockResolvedValue({
      id: '18',
      format: '18',
      ext: 'mp4',
      contentType: 'video/mp4',
      mediaKind: 'video',
      estimatedSize: 1000,
    });
    reservationService.evaluateAdmission.mockResolvedValue({ kind: 'process' });
    reservationService.reserve.mockResolvedValue(undefined);
    reservationService.release.mockResolvedValue(undefined);
    fileStore.attachQueueJob.mockResolvedValue(undefined);
  });

  it('throws when new requests are disabled', async () => {
    const service = createService();
    config.enableNewRequests = false;

    await expect(
      service.submit({
        url: 'https://example.com/video',
        sessionId: 'session-1',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws when the session job rate limit is exceeded', async () => {
    const service = createService();
    sessionService.incrementSessionJobs.mockResolvedValue(6);

    await expect(
      service.submit({
        url: 'https://example.com/video',
        sessionId: 'session-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(sizeEstimator.estimate).not.toHaveBeenCalled();
  });

  it('stores a queued download when storage admission says to wait', async () => {
    const service = createService();
    reservationService.evaluateAdmission.mockResolvedValue({
      kind: 'queue',
      reason: 'storage_capacity',
    });
    fileStore.createQueuedDownload.mockResolvedValue({
      id: 'file-queued-1',
    });

    const result = await service.submit({
      url: 'https://example.com/video',
      sessionId: 'session-1',
      profileId: '18',
    });

    expect(result).toEqual({
      fileId: 'file-queued-1',
      jobId: null,
      estimatedSize: 1000,
      status: FileStatus.QUEUED,
    });
    expect(fileStore.createQueuedDownload).toHaveBeenCalledWith({
      url: 'https://example.com/video',
      sessionId: 'session-1',
      estimatedSize: 1000,
      profileId: '18',
      output: {
        mediaKind: 'video',
        extension: 'mp4',
        contentType: 'video/mp4',
      },
    });
    expect(reservationService.reserve).not.toHaveBeenCalled();
    expect(queueProducer.enqueueDownloadJob).not.toHaveBeenCalled();
  });

  it('persists and enqueues a selected profile for immediate processing', async () => {
    const service = createService();
    fileStore.createProcessingDownload.mockResolvedValue({
      id: 'file-processing-1',
    });
    queueProducer.enqueueDownloadJob.mockResolvedValue('job-1');

    const result = await service.submit({
      url: 'https://example.com/video',
      sessionId: 'session-1',
      profileId: '18',
    });

    expect(result).toEqual({
      fileId: 'file-processing-1',
      jobId: 'job-1',
      estimatedSize: 1000,
      status: FileStatus.PROCESSING,
    });
    expect(fileStore.createProcessingDownload).toHaveBeenCalledWith({
      url: 'https://example.com/video',
      sessionId: 'session-1',
      estimatedSize: 1000,
      profileId: '18',
      output: {
        mediaKind: 'video',
        extension: 'mp4',
        contentType: 'video/mp4',
      },
    });
    expect(queueProducer.enqueueDownloadJob).toHaveBeenCalledWith({
      fileId: 'file-processing-1',
      url: 'https://example.com/video',
      sessionId: 'session-1',
      reservedBytes: 1000,
      profileId: '18',
      output: {
        mediaKind: 'video',
        extension: 'mp4',
        contentType: 'video/mp4',
      },
    });
    expect(fileStore.attachQueueJob).toHaveBeenCalledWith(
      'file-processing-1',
      'job-1',
    );
  });

  it('rejects an unavailable selected profile', async () => {
    const service = createService();
    profileCatalogue.getProfile.mockResolvedValue(null);

    await expect(
      service.submit({
        url: 'https://example.com/video',
        sessionId: 'session-1',
        profileId: 'missing',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(reservationService.evaluateAdmission).not.toHaveBeenCalled();
  });

  it('maps admission rejection to a bad request for file size limits', async () => {
    const service = createService();
    reservationService.evaluateAdmission.mockResolvedValue({
      kind: 'reject',
      reason: 'max_file_size',
      message: 'Requested file exceeds max file size',
    });

    await expect(
      service.submit({
        url: 'https://example.com/video',
        sessionId: 'session-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('releases reservation and marks the file failed when enqueue fails', async () => {
    const service = createService();
    const error = new Error('redis unavailable');
    fileStore.createProcessingDownload.mockResolvedValue({
      id: 'file-processing-1',
    });
    queueProducer.enqueueDownloadJob.mockRejectedValue(error);

    await expect(
      service.submit({
        url: 'https://example.com/video',
        sessionId: 'session-1',
      }),
    ).rejects.toThrow(error);

    expect(reservationService.release).toHaveBeenCalledWith('session-1', 1000);
    expect(fileStore.markFailed).toHaveBeenCalledWith(
      'file-processing-1',
      'Error: redis unavailable',
    );
  });
});
