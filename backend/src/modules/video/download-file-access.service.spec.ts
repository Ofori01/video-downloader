import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FileStatus } from '../../entities/file.entity';
import { DownloadFileAccessService } from './download-file-access.service';

interface FileAccessRecord {
  id?: string;
  key?: string;
  sessionId?: string;
  status?: FileStatus;
  contentType?: string | null;
  downloadedAt?: Date | null;
  expiresAt?: Date | null;
}

describe('DownloadFileAccessService', () => {
  const config = {
    fileTtlSeconds: 3600,
  };

  const fileStore: {
    findForSession: jest.Mock<
      Promise<FileAccessRecord | null>,
      [string, string]
    >;
    save: jest.Mock<Promise<FileAccessRecord>, [FileAccessRecord]>;
  } = {
    findForSession: jest.fn<
      Promise<FileAccessRecord | null>,
      [string, string]
    >(),
    save: jest.fn<Promise<FileAccessRecord>, [FileAccessRecord]>(),
  };

  const sessionService = {
    incrementSessionDownloads: jest.fn(),
  };

  const storageService = {
    getSignedDownloadUrl: jest.fn(),
  };

  const createService = () =>
    new DownloadFileAccessService(
      config as never,
      fileStore as never,
      sessionService as never,
      storageService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    storageService.getSignedDownloadUrl.mockResolvedValue(
      'https://example.com/signed',
    );
  });

  it('returns file status only for the owning session', async () => {
    const service = createService();
    fileStore.findForSession.mockResolvedValue({
      id: 'file-1',
      sessionId: 'session-1',
    });

    await expect(service.getFileStatus('file-1', 'session-1')).resolves.toEqual(
      {
        id: 'file-1',
        sessionId: 'session-1',
      },
    );
  });

  it('throws not found when download file does not belong to session', async () => {
    const service = createService();
    fileStore.findForSession.mockResolvedValue(null);

    await expect(
      service.getDownloadUrl('file-1', 'different-session'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws bad request when file is not ready', async () => {
    const service = createService();
    fileStore.findForSession.mockResolvedValue({
      id: 'file-1',
      sessionId: 'session-1',
      status: FileStatus.PROCESSING,
    });

    await expect(
      service.getDownloadUrl('file-1', 'session-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preserves existing expiry when first download is requested', async () => {
    const service = createService();
    const existingExpiry = new Date(Date.now() + 30 * 60 * 1000);
    fileStore.findForSession.mockResolvedValue({
      id: 'file-1',
      key: 'videos/file-1.mp4',
      sessionId: 'session-1',
      status: FileStatus.READY,
      contentType: 'video/mp4',
      downloadedAt: null,
      expiresAt: existingExpiry,
    });

    await expect(service.getDownloadUrl('file-1', 'session-1')).resolves.toBe(
      'https://example.com/signed',
    );

    expect(fileStore.save).toHaveBeenCalledTimes(1);
    const saved = fileStore.save.mock.calls[0][0];
    expect(saved.downloadedAt).toBeInstanceOf(Date);
    expect(saved.expiresAt).toBe(existingExpiry);
    expect(sessionService.incrementSessionDownloads).toHaveBeenCalledWith(
      'session-1',
    );
    expect(storageService.getSignedDownloadUrl).toHaveBeenCalledWith(
      'videos/file-1.mp4',
      'video/mp4',
    );
  });
});
