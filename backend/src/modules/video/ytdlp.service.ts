import { Injectable, Logger } from '@nestjs/common';
import { YtDlp } from 'ytdlp-nodejs';
import { AppConfigService } from '../../config/app-config.service';

interface YtDlpStreamBuilder {
  filter(mode: string): YtDlpStreamBuilder;
  quality(level: string): YtDlpStreamBuilder;
  type(container: string): YtDlpStreamBuilder;
  on(event: string, listener: (error: unknown) => void): YtDlpStreamBuilder;
  getStream(): NodeJS.ReadableStream;
}

@Injectable()
export class YtDlpService {
  private readonly logger = new Logger(YtDlpService.name);
  private readonly client: YtDlp;

  constructor(private readonly config: AppConfigService) {
    this.client = new YtDlp({
      binaryPath: this.config.ytDlpBinaryPath,
      ffmpegPath: this.config.ffmpegBinaryPath,
    });
  }

  async getMetadata(url: string): Promise<unknown> {
    return this.client.getInfoAsync(url);
  }

  getDownloadStream(url: string): NodeJS.ReadableStream {
    const builder = this.client.stream(url) as unknown as YtDlpStreamBuilder;

    builder
      .filter('audioandvideo')
      .quality('highest')
      .type('mp4')
      .on('error', (error: unknown) => {
        this.logger.error(`yt-dlp stream error: ${String(error)}`);
      });

    return builder.getStream();
  }
}
