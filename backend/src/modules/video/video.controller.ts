import {
  Body,
  InternalServerErrorException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { VideoService } from './video.service';

@Controller()
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('video/jobs')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createJob(@Body() body: CreateVideoJobDto, @Req() req: Request) {
    const sessionId = req.sessionContext?.id;
    if (!sessionId) {
      throw new InternalServerErrorException('Session context missing');
    }

    return this.videoService.submitDownload(body.url, sessionId);
  }

  @Get('video/files/:id')
  async getStatus(@Param('id') id: string, @Req() req: Request) {
    const sessionId = req.sessionContext?.id;
    if (!sessionId) {
      throw new InternalServerErrorException('Session context missing');
    }

    return this.videoService.getFileStatus(id, sessionId);
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

    const signedUrl = await this.videoService.getDownloadUrl(id, sessionId);
    res.redirect(signedUrl);
  }
}
