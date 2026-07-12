import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import {
  DownloadFormatRequest,
  DownloadFormatResolver,
} from './download-format-resolver.service';
import { YtDlpStreamCommandBuilder } from './ytdlp-stream-command.service';
import { YtDlpStreamDiagnostics } from './ytdlp.types';

@Injectable()
export class YtDlpStreamClient {
  private readonly logger = new Logger(YtDlpStreamClient.name);

  constructor(
    private readonly commandBuilder: YtDlpStreamCommandBuilder,
    private readonly formatResolver: DownloadFormatResolver,
  ) {}

  getDownloadStream(
    url: string,
    request?: DownloadFormatRequest,
  ): {
    stream: NodeJS.ReadableStream;
    diagnostics: YtDlpStreamDiagnostics;
  } {
    const resolvedFormat = this.formatResolver.resolve(request);
    const command = this.commandBuilder.buildStreamCommand(url, resolvedFormat);
    const diagnostics: YtDlpStreamDiagnostics = {
      command: command.command,
      stderrTail: [],
      profile: command.profile,
    };

    const processStream = new PassThrough();
    const child = spawn(command.binary, command.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const pushStderrLine = (raw: string) => {
      const line = raw.trim();
      if (!line) {
        return;
      }

      diagnostics.stderrTail = [...diagnostics.stderrTail, line].slice(-6);

      if (/size=.+time=.+speed=/i.test(line)) {
        diagnostics.lastProgress = line.replace(/\s+/g, ' ').trim();
      }
    };

    let stderrBuffer = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() ?? '';
      for (const line of lines) {
        pushStderrLine(line);
      }
    });

    child.on('error', (error: Error) => {
      this.logger.error(
        `yt-dlp process error (profile=${diagnostics.profile}): ${String(
          error,
        )}`,
      );
      processStream.destroy(error);
    });

    child.stdout?.on('error', (error: Error) => {
      processStream.destroy(error);
    });

    child.stdout?.pipe(processStream);

    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (stderrBuffer.trim()) {
        pushStderrLine(stderrBuffer);
      }

      if (code === 0) {
        processStream.end();
        return;
      }

      const detail =
        code === null
          ? `signal=${signal ?? 'unknown'}`
          : `code=${String(code)} signal=${signal ?? 'none'}`;
      processStream.destroy(new Error(`yt-dlp process exited (${detail})`));
    });

    processStream.on('close', () => {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGTERM');
      }
    });

    return { stream: processStream, diagnostics };
  }
}
