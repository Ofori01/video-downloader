import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
import { VideoController } from './video.controller';
import type { AvailableProfile } from './ytdlp.types';

describe('VideoController', () => {
  const downloadFileAccess = {
    getFileStatus: jest.fn(),
    getDownloadUrl: jest.fn(),
  };

  const downloadIntake = {
    submit: jest.fn(),
  };

  const profileCatalogue = {
    getAvailableProfiles: jest.fn(),
  };

  const profileSnapshotStore = {
    saveProfiles: jest.fn(),
  };

  const sourceCooldown = {
    getStatus: jest.fn(),
  };

  const sourceProfileCache = {
    getProfiles: jest.fn(),
    saveProfiles: jest.fn(),
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
  ];

  const createController = () =>
    new VideoController(
      downloadFileAccess as never,
      downloadIntake as never,
      profileCatalogue as never,
      profileSnapshotStore as never,
      sourceCooldown as never,
      sourceProfileCache as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    sourceCooldown.getStatus.mockResolvedValue({
      source: 'generic',
      active: false,
    });
    sourceProfileCache.getProfiles.mockResolvedValue(null);
    profileCatalogue.getAvailableProfiles.mockResolvedValue(profiles);
  });

  it('stores global and session profile snapshots for a cache miss', async () => {
    const controller = createController();
    const req = {
      sessionContext: { id: 'session-1' },
    } as unknown as Request;

    await expect(
      controller.getProfiles(req, 'https://example.com/video'),
    ).resolves.toEqual(profiles);

    expect(profileSnapshotStore.saveProfiles).toHaveBeenCalledWith(
      'session-1',
      'https://example.com/video',
      profiles,
    );
    expect(sourceProfileCache.saveProfiles).toHaveBeenCalledWith(
      'https://example.com/video',
      profiles,
    );
  });

  it('serves cached profiles without asking the catalogue', async () => {
    const controller = createController();
    const req = {
      sessionContext: { id: 'session-1' },
    } as unknown as Request;
    sourceProfileCache.getProfiles.mockResolvedValue(profiles);

    await expect(
      controller.getProfiles(req, 'https://example.com/video'),
    ).resolves.toEqual(profiles);

    expect(profileCatalogue.getAvailableProfiles).not.toHaveBeenCalled();
    expect(sourceProfileCache.saveProfiles).not.toHaveBeenCalled();
    expect(profileSnapshotStore.saveProfiles).toHaveBeenCalledWith(
      'session-1',
      'https://example.com/video',
      profiles,
    );
  });

  it('rejects profile lookup while the source is cooling down', async () => {
    const controller = createController();
    const req = {
      sessionContext: { id: 'session-1' },
    } as unknown as Request;
    sourceCooldown.getStatus.mockResolvedValue({
      source: 'instagram',
      active: true,
    });

    await expect(
      controller.getProfiles(req, 'https://instagram.com/reel/abc'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(sourceProfileCache.getProfiles).not.toHaveBeenCalled();
    expect(profileCatalogue.getAvailableProfiles).not.toHaveBeenCalled();
    expect(profileSnapshotStore.saveProfiles).not.toHaveBeenCalled();
  });

  it('requires session context before profile lookup', async () => {
    const controller = createController();
    const req = {} as Request;

    await expect(
      controller.getProfiles(req, 'https://example.com/video'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(profileCatalogue.getAvailableProfiles).not.toHaveBeenCalled();
    expect(profileSnapshotStore.saveProfiles).not.toHaveBeenCalled();
  });
});
