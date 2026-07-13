import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import {
  DownloadFormatRequest,
  DownloadFormatResolver,
  ResolvedDownloadFormat,
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

    if (resolvedFormat.requiresFileOutput) {
      return this.getFileBackedDownloadStream(url, resolvedFormat);
    }

    return this.getStdoutDownloadStream(url, resolvedFormat);
  }

  private getStdoutDownloadStream(
    url: string,
    resolvedFormat: ResolvedDownloadFormat,
  ): {
    stream: NodeJS.ReadableStream;
    diagnostics: YtDlpStreamDiagnostics;
  } {
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

  private getFileBackedDownloadStream(
    url: string,
    resolvedFormat: ResolvedDownloadFormat,
  ): {
    stream: NodeJS.ReadableStream;
    diagnostics: YtDlpStreamDiagnostics;
  } {
    const processStream = new PassThrough();
    const diagnostics: YtDlpStreamDiagnostics = {
      stderrTail: [],
      profile: resolvedFormat.profile,
    };

    void this.startFileBackedDownload(
      url,
      resolvedFormat,
      processStream,
      diagnostics,
    );

    return { stream: processStream, diagnostics };
  }

  private async startFileBackedDownload(
    url: string,
    resolvedFormat: ResolvedDownloadFormat,
    processStream: PassThrough,
    diagnostics: YtDlpStreamDiagnostics,
  ): Promise<void> {
    let tempDir: string;
    try {
      tempDir = await mkdtemp(join(tmpdir(), 'video-downloader-'));
    } catch (error) {
      processStream.destroy(error as Error);
      return;
    }

    const outputTemplate = join(tempDir, 'download.%(ext)s');
    const command = this.commandBuilder.buildStreamCommand(
      url,
      resolvedFormat,
      {
        kind: 'file',
        outputTemplate,
      },
    );
    diagnostics.command = command.command;

    let childClosed = false;
    const child = spawn(command.binary, command.args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const flushStderr = this.attachStderr(child, diagnostics);

    processStream.on('close', () => {
      if (!childClosed && child.exitCode === null && !child.killed) {
        child.kill('SIGTERM');
      }
      void this.cleanupTempDir(tempDir);
    });

    child.on('error', (error: Error) => {
      this.logger.error(
        `yt-dlp process error (profile=${diagnostics.profile}): ${String(
          error,
        )}`,
      );
      processStream.destroy(error);
    });

    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      void this.handleFileBackedProcessClose({
        code,
        signal,
        tempDir,
        processStream,
        flushStderr,
        markChildClosed: () => {
          childClosed = true;
        },
      });
    });
  }

  private async handleFileBackedProcessClose(input: {
    code: number | null;
    signal: NodeJS.Signals | null;
    tempDir: string;
    processStream: PassThrough;
    flushStderr: () => void;
    markChildClosed: () => void;
  }): Promise<void> {
    input.markChildClosed();
    input.flushStderr();

    if (input.code !== 0) {
      const detail =
        input.code === null
          ? `signal=${input.signal ?? 'unknown'}`
          : `code=${String(input.code)} signal=${input.signal ?? 'none'}`;
      input.processStream.destroy(
        new Error(`yt-dlp process exited (${detail})`),
      );
      return;
    }

    try {
      const completedFile = await this.findCompletedDownloadFile(input.tempDir);
      const fileStream = createReadStream(completedFile);
      fileStream.on('error', (error) => input.processStream.destroy(error));
      fileStream.pipe(input.processStream);
    } catch (error) {
      input.processStream.destroy(error as Error);
    }
  }

  private attachStderr(
    child: ReturnType<typeof spawn>,
    diagnostics: YtDlpStreamDiagnostics,
  ): () => void {
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

    return () => {
      if (stderrBuffer.trim()) {
        pushStderrLine(stderrBuffer);
        stderrBuffer = '';
      }
    };
  }

  private async findCompletedDownloadFile(tempDir: string): Promise<string> {
    const entries = await readdir(tempDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter(
          (entry) => entry.isFile() && !this.isTransientYtDlpFile(entry.name),
        )
        .map(async (entry) => {
          const path = join(tempDir, entry.name);
          return {
            path,
            size: (await stat(path)).size,
          };
        }),
    );

    const largest = files.sort((a, b) => b.size - a.size)[0];
    if (!largest) {
      throw new Error('yt-dlp completed without producing a download file');
    }

    return largest.path;
  }

  private isTransientYtDlpFile(fileName: string): boolean {
    return (
      fileName.endsWith('.part') ||
      fileName.endsWith('.ytdl') ||
      fileName.endsWith('.temp')
    );
  }

  private async cleanupTempDir(tempDir: string): Promise<void> {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to clean yt-dlp temp directory ${tempDir}: ${String(error)}`,
      );
    }
  }
}
