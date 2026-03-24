import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { VideoService } from './video.service';
import { FileStatus } from '../../entities/file.entity';

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
