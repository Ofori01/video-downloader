import { Injectable } from '@nestjs/common';
import { YtDlp } from 'ytdlp-nodejs';
import { AppConfigService } from '../../config/app-config.service';
import { normalizeYtDlpMetadata } from './ytdlp-metadata-normalizer';
import {
  YtDlpSourceMetadataOptions,
  YtDlpSourceOptionsService,
} from './ytdlp-source-options.service';
import { YtDlpMetadata } from './ytdlp.types';

type YtDlpInfoOptions = Parameters<YtDlp['getInfoAsync']>[1] &
  YtDlpSourceMetadataOptions;

@Injectable()
export class YtDlpMetadataClient {
  private readonly client: YtDlp;

  constructor(
    private readonly config: AppConfigService,
    private readonly sourceOptions: YtDlpSourceOptionsService,
  ) {
    this.client = new YtDlp({
      binaryPath: this.config.ytDlpBinaryPath,
      ffmpegPath: this.config.ffmpegBinaryPath,
    });
  }

  async getMetadata(url: string): Promise<YtDlpMetadata | null> {
    const options: YtDlpInfoOptions = {
      flatPlaylist: false,
      ...this.sourceOptions.getMetadataOptions(url),
    };
    const rawMetadata: unknown = await this.client.getInfoAsync(url, options);
    return normalizeYtDlpMetadata(rawMetadata);
  }
}
