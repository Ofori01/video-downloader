import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { ResolvedDownloadFormat } from './download-format-resolver.service';

export interface YtDlpStreamCommand {
  binary: string;
  args: string[];
  command: string;
  profile: ResolvedDownloadFormat['profile'];
}

export type YtDlpOutputTarget =
  | { kind: 'stdout' }
  | { kind: 'file'; outputTemplate: string };

@Injectable()
export class YtDlpStreamCommandBuilder {
  constructor(private readonly config: AppConfigService) {}

  buildStreamCommand(
    url: string,
    resolvedFormat: ResolvedDownloadFormat,
    outputTarget: YtDlpOutputTarget = { kind: 'stdout' },
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
    ];

    if (this.config.ffmpegBinaryPath) {
      args.push(
        '--ffmpeg-location',
        this.config.ffmpegBinaryPath,
        '--merge-output-format',
        'mp4',
      );
    }

    args.push(
      '-f',
      resolvedFormat.format,
      '-o',
      this.getOutputValue(outputTarget),
      url,
    );

    const binary = this.config.ytDlpBinaryPath || 'yt-dlp';

    return {
      binary,
      args,
      command: `${binary} ${args.join(' ')}`,
      profile: resolvedFormat.profile,
    };
  }

  private getOutputValue(outputTarget: YtDlpOutputTarget): string {
    return outputTarget.kind === 'stdout' ? '-' : outputTarget.outputTemplate;
  }
}
