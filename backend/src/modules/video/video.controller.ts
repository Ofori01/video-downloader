import {
  Body,
  InternalServerErrorException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  Query,
  ServiceUnavailableException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { AvailableProfileDto } from './dto/available-profiles.dto';
import { DownloadFileAccessService } from './download-file-access.service';
import { DownloadIntakeService } from './download-intake.service';
import { ProfileCatalogueService } from './profile-catalogue.service';
import { ProfileSnapshotStoreService } from './profile-snapshot-store.service';
import { SourceCooldownService } from './source-cooldown.service';
import { GENERIC_SOURCE_BUSY_MESSAGE } from './source-failure';
import { SourceProfileCacheService } from './source-profile-cache.service';

@Controller()
export class VideoController {
  constructor(
    private readonly downloadFileAccess: DownloadFileAccessService,
    private readonly downloadIntake: DownloadIntakeService,
    private readonly profileCatalogue: ProfileCatalogueService,
    private readonly profileSnapshotStore: ProfileSnapshotStoreService,
    private readonly sourceCooldown: SourceCooldownService,
    private readonly sourceProfileCache: SourceProfileCacheService,
  ) {}

  @Post('video/jobs')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createJob(@Body() body: CreateVideoJobDto, @Req() req: Request) {
    const sessionId = req.sessionContext?.id;
    if (!sessionId) {
      throw new InternalServerErrorException('Session context missing');
    }

    return this.downloadIntake.submit({
      url: body.url,
      sessionId,
      profileId: body.profileId,
    });
  }

  @Get('video/profiles')
  async getProfiles(
    @Req() req: Request,
    @Query('url') url?: string,
  ): Promise<AvailableProfileDto[]> {
    if (!url) {
      return [];
    }

    const sessionId = req.sessionContext?.id;
    if (!sessionId) {
      throw new InternalServerErrorException('Session context missing');
    }

    const cooldown = await this.sourceCooldown.getStatus(url);
    if (cooldown.active) {
      throw new ServiceUnavailableException(GENERIC_SOURCE_BUSY_MESSAGE);
    }

    const cachedProfiles = await this.sourceProfileCache.getProfiles(url);
    if (cachedProfiles) {
      await this.profileSnapshotStore.saveProfiles(
        sessionId,
        url,
        cachedProfiles,
      );
      return cachedProfiles;
    }

    const profiles = await this.profileCatalogue.getAvailableProfiles(url);
    if (profiles.length > 0) {
      await this.sourceProfileCache.saveProfiles(url, profiles);
    }

    await this.profileSnapshotStore.saveProfiles(sessionId, url, profiles);

    return profiles;
  }

  @Get('video/files/:id')
  async getStatus(@Param('id') id: string, @Req() req: Request) {
    const sessionId = req.sessionContext?.id;
    if (!sessionId) {
      throw new InternalServerErrorException('Session context missing');
    }

    return this.downloadFileAccess.getFileStatus(id, sessionId);
  }

  @Get('download/:id')
  async download(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const sessionId = req.sessionContext?.id;
    if (!sessionId) {
      throw new InternalServerErrorException('Session context missing');
    }

    const signedUrl = await this.downloadFileAccess.getDownloadUrl(
      id,
      sessionId,
    );
    res.redirect(signedUrl);
  }
}
