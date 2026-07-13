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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { AvailableProfileDto } from './dto/available-profiles.dto';
import { DownloadFileAccessService } from './download-file-access.service';
import { DownloadIntakeService } from './download-intake.service';
import { ProfileCatalogueService } from './profile-catalogue.service';

@Controller()
export class VideoController {
  constructor(
    private readonly downloadFileAccess: DownloadFileAccessService,
    private readonly downloadIntake: DownloadIntakeService,
    private readonly profileCatalogue: ProfileCatalogueService,
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
    @Query('url') url?: string,
  ): Promise<AvailableProfileDto[]> {
    if (!url) {
      return [];
    }

    const profiles = await this.profileCatalogue.getAvailableProfiles(url);
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
