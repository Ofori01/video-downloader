import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppConfigService } from '../../config/app-config.service';
import { BinaryReadinessResult, RuntimeCheck } from './runtime.types';

const execFileAsync = promisify(execFile);
const BINARY_CHECK_TIMEOUT_MS = 3_000;

interface RuntimeBinary {
  name: 'yt-dlp' | 'ffmpeg';
  executable: string;
  args: string[];
}

@Injectable()
export class RuntimeBinaryReadinessService {
  constructor(private readonly config: AppConfigService) {}

  async checkRequiredBinaries(): Promise<BinaryReadinessResult> {
    const [ytDlp, ffmpeg] = await Promise.all([
      this.checkBinary({
        name: 'yt-dlp',
        executable: this.config.ytDlpBinaryPath ?? 'yt-dlp',
        args: ['--version'],
      }),
      this.checkBinary({
        name: 'ffmpeg',
        executable: this.config.ffmpegBinaryPath ?? 'ffmpeg',
        args: ['-version'],
      }),
    ]);

    return { ytDlp, ffmpeg };
  }

  private async checkBinary(binary: RuntimeBinary): Promise<RuntimeCheck> {
    try {
      const result = await execFileAsync(binary.executable, binary.args, {
        timeout: BINARY_CHECK_TIMEOUT_MS,
        windowsHide: true,
      });
      const detail = this.firstOutputLine(result.stdout, result.stderr);
      return {
        status: 'up',
        details: detail || `${binary.name} responded`,
      };
    } catch (error) {
      return {
        status: 'down',
        details: `${binary.name} unavailable: ${String(error)}`,
      };
    }
  }

  private firstOutputLine(
    stdout: string | Buffer | undefined,
    stderr: string | Buffer | undefined,
  ): string | undefined {
    const output = `${this.outputToString(stdout)}\n${this.outputToString(
      stderr,
    )}`;
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
  }

  private outputToString(output: string | Buffer | undefined): string {
    if (typeof output === 'string') {
      return output;
    }

    if (Buffer.isBuffer(output)) {
      return output.toString('utf8');
    }

    return '';
  }
}
