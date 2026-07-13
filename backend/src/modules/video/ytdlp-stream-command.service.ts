import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { ResolvedDownloadFormat } from './download-format-resolver.service';

export interface YtDlpStreamCommand {
  binary: string;
  args: string[];
  command: string;
  profile: ResolvedDownloadFormat['profile'];
}

@Injectable()
export class YtDlpStreamCommandBuilder {
  constructor(private readonly config: AppConfigService) {}

  buildStreamCommand(
    url: string,
    resolvedFormat: ResolvedDownloadFormat,
  ): YtDlpStreamCommand {
    const args = [
      '--no-playlist',
      '--newline',
      '--socket-timeout',
      '20',
      '--retries',
      '1',
      '--fragment-retries',
      '1',
      '--extractor-retries',
      '1',
      '--force-ipv4',
      '-f',
      resolvedFormat.format,
      '-o',
      '-',
      url,
    ];

    if (this.config.ffmpegBinaryPath) {
      args.unshift(this.config.ffmpegBinaryPath);
      args.unshift('--ffmpeg-location');
    }

    const binary = this.config.ytDlpBinaryPath || 'yt-dlp';

    return {
      binary,
      args,
      command: `${binary} ${args.join(' ')}`,
      profile: resolvedFormat.profile,
    };
  }
}
