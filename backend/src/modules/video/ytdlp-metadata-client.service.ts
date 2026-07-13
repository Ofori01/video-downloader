import { Injectable } from '@nestjs/common';
import { YtDlp } from 'ytdlp-nodejs';
import { AppConfigService } from '../../config/app-config.service';
import { normalizeYtDlpMetadata } from './ytdlp-metadata-normalizer';
import { YtDlpMetadata } from './ytdlp.types';

@Injectable()
export class YtDlpMetadataClient {
  private readonly client: YtDlp;

  constructor(private readonly config: AppConfigService) {
    this.client = new YtDlp({
      binaryPath: this.config.ytDlpBinaryPath,
      ffmpegPath: this.config.ffmpegBinaryPath,
    });
  }

  async getMetadata(url: string): Promise<YtDlpMetadata | null> {
    const rawMetadata: unknown = await this.client.getInfoAsync(url, {
      flatPlaylist: false,
    });
    return normalizeYtDlpMetadata(rawMetadata);
  }
}
