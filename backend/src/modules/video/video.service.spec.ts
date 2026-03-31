import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { VideoService } from './video.service';
import { FileStatus } from '../../entities/file.entity';
import { STORAGE_USED_KEY } from '../queue/queue.constants';

describe('VideoService', () => {
  const fileRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const queueProducer = {
    enqueueDownloadJob: jest.fn(),
  };

  const redisService = {
    getNumber: jest.fn(),
    incrementBy: jest.fn(),
    decrementBy: jest.fn(),
    raw: {
      set: jest.fn(),
    },
  };

  const sessionService = {
    incrementSessionJobs: jest.fn(),
    getSessionBytes: jest.fn(),
    reserveSessionBytes: jest.fn(),
    releaseSessionBytes: jest.fn(),
    setSessionBytes: jest.fn(),
    incrementSessionDownloads: jest.fn(),
  };

  const storageService = {
    getSignedDownloadUrl: jest.fn(),
  };

  const ytDlpService = {
    getMetadata: jest.fn(),
  };

  const config = {
    enableNewRequests: true,
    sessionMaxJobs: 5,
    maxFileBytes: 1_000_000_000,
    sessionMaxBytes: 500_000_000,
    maxStorageBytes: 10_000_000_000,
    fileTtlSeconds: 3600,
  };

  const createService = () =>
    new VideoService(
      fileRepository as never,
      config as never,
      queueProducer as never,
      redisService as never,
      sessionService as never,
      storageService as never,
      ytDlpService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    config.enableNewRequests = true;
    config.maxStorageBytes = 10_000_000_000;
  });

  it('throws when new requests are disabled', async () => {
    const service = createService();
    config.enableNewRequests = false;

    await expect(
      service.submitDownload('https://example.com/video', 'session-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns queued status when global storage limit is exceeded', async () => {
    const service = createService();

    sessionService.incrementSessionJobs.mockResolvedValue(1);
    ytDlpService.getMetadata.mockResolvedValue({ filesize: 1000 });
    sessionService.getSessionBytes.mockResolvedValue(0);
    redisService.getNumber.mockResolvedValue(5000);
    config.maxStorageBytes = 4500;

    fileRepository.create.mockImplementation((value) => value);
    fileRepository.save.mockResolvedValue({
      id: 'file-queued-1',
      key: 'pending/key',
      sourceUrl: 'https://example.com/video',
      size: '1000',
      status: FileStatus.QUEUED,
      sessionId: 'session-1',
    });

    const result = await service.submitDownload(
      'https://example.com/video',
      'session-1',
    );

    expect(result).toEqual({
      fileId: 'file-queued-1',
      jobId: null,
      estimatedSize: 1000,
      status: FileStatus.QUEUED,
    });
    expect(queueProducer.enqueueDownloadJob).not.toHaveBeenCalled();
    expect(sessionService.reserveSessionBytes).not.toHaveBeenCalled();
  });

  it('falls back to DB usage when redis session bytes are stale high', async () => {
    const service = createService();

    sessionService.incrementSessionJobs.mockResolvedValue(1);
    ytDlpService.getMetadata.mockResolvedValue({ filesize: 1000 });
    sessionService.getSessionBytes.mockResolvedValue(600_000_000);
    redisService.getNumber.mockResolvedValue(0);

    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };
    fileRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    fileRepository.create.mockImplementation((value) => value);
    fileRepository.save
      .mockResolvedValueOnce({
        id: 'file-processing-1',
        key: 'pending/key',
        sourceUrl: 'https://example.com/video',
        size: '1000',
        status: FileStatus.PROCESSING,
        sessionId: 'session-1',
      })
      .mockResolvedValueOnce({
        id: 'file-processing-1',
        key: 'pending/key',
        sourceUrl: 'https://example.com/video',
        size: '1000',
        status: FileStatus.PROCESSING,
        sessionId: 'session-1',
        queueJobId: 'job-1',
      });
    queueProducer.enqueueDownloadJob.mockResolvedValue('job-1');

    const result = await service.submitDownload(
      'https://example.com/video',
      'session-1',
    );

    expect(result.status).toBe(FileStatus.PROCESSING);
    expect(sessionService.setSessionBytes).toHaveBeenCalledWith('session-1', 0);
  });

  it('throws bad request when estimated size exceeds per-session quota', async () => {
    const service = createService();

    sessionService.incrementSessionJobs.mockResolvedValue(1);
    ytDlpService.getMetadata.mockResolvedValue({ filesize: 600_000_000 });

    await expect(
      service.submitDownload('https://example.com/video', 'session-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sessionService.getSessionBytes).not.toHaveBeenCalled();
    expect(queueProducer.enqueueDownloadJob).not.toHaveBeenCalled();
  });

  it('releases reserved bytes when actual output is smaller', async () => {
    const service = createService();

    await service.reconcileReservationForCompletedFile('session-1', 1000, 750);

    expect(sessionService.releaseSessionBytes).toHaveBeenCalledWith(
      'session-1',
      250,
    );
    expect(redisService.decrementBy).toHaveBeenCalledWith(
      STORAGE_USED_KEY,
      250,
    );
    expect(sessionService.reserveSessionBytes).not.toHaveBeenCalled();
    expect(redisService.incrementBy).not.toHaveBeenCalled();
  });

  it('reserves additional bytes when actual output is larger', async () => {
    const service = createService();

    await service.reconcileReservationForCompletedFile('session-1', 1000, 1250);

    expect(sessionService.reserveSessionBytes).toHaveBeenCalledWith(
      'session-1',
      250,
    );
    expect(redisService.incrementBy).toHaveBeenCalledWith(
      STORAGE_USED_KEY,
      250,
    );
    expect(sessionService.releaseSessionBytes).not.toHaveBeenCalled();
    expect(redisService.decrementBy).not.toHaveBeenCalled();
  });

  it('does nothing when reserved and actual sizes are equal', async () => {
    const service = createService();

    await service.reconcileReservationForCompletedFile('session-1', 1000, 1000);

    expect(sessionService.reserveSessionBytes).not.toHaveBeenCalled();
    expect(redisService.incrementBy).not.toHaveBeenCalled();
    expect(sessionService.releaseSessionBytes).not.toHaveBeenCalled();
    expect(redisService.decrementBy).not.toHaveBeenCalled();
  });

  it('sets expiresAt when marking file ready', async () => {
    const service = createService();

    await service.markReady('file-1', 'videos/file-1.mp4', 2048);

    expect(fileRepository.update).toHaveBeenCalledWith(
      'file-1',
      expect.objectContaining({
        key: 'videos/file-1.mp4',
        size: '2048',
        status: FileStatus.READY,
        errorReason: null,
        expiresAt: expect.any(Date),
      }),
    );
  });

  it('preserves existing expiresAt when first download is requested', async () => {
    const service = createService();
    const existingExpiry = new Date(Date.now() + 30 * 60 * 1000);
    storageService.getSignedDownloadUrl.mockResolvedValue(
      'https://example.com/signed',
    );
    fileRepository.findOneBy.mockResolvedValue({
      id: 'file-1',
      key: 'videos/file-1.mp4',
      sessionId: 'session-1',
      status: FileStatus.READY,
      downloadedAt: null,
      expiresAt: existingExpiry,
    });

    await service.getDownloadUrl('file-1', 'session-1');

    const saved = fileRepository.save.mock.calls[0]?.[0];
    expect(saved.downloadedAt).toEqual(expect.any(Date));
    expect(saved.expiresAt).toBe(existingExpiry);
  });

  it('throws not found when download file does not belong to session', async () => {
    const service = createService();
    fileRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.getDownloadUrl('file-1', 'different-session'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws bad request when file is not ready', async () => {
    const service = createService();
    fileRepository.findOneBy.mockResolvedValue({
      id: 'file-1',
      sessionId: 'session-1',
      status: FileStatus.PROCESSING,
    });

    await expect(
      service.getDownloadUrl('file-1', 'session-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
