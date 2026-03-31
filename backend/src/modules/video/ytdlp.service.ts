/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { YtDlp } from 'ytdlp-nodejs';
import { AppConfigService } from '../../config/app-config.service';

export interface YtDlpStreamDiagnostics {
  command?: string;
  stderrTail: string[];
  lastProgress?: string;
  profile: 'default' | 'fallback' | 'custom';
}

export interface AvailableProfile {
  id: string;
  label: string;
  format: string;
  resolution?: string;
  codec?: string;
  audioCodec?: string;
  estimatedSize?: number;
  isAudioOnly: boolean;
}

interface GetDownloadStreamOptions {
  fallbackProfile?: boolean;
  formatId?: string;
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

  getDownloadStream(
    url: string,
    options?: GetDownloadStreamOptions,
  ): {
    stream: NodeJS.ReadableStream;
    diagnostics: YtDlpStreamDiagnostics;
  } {
    const useFallbackProfile = options?.fallbackProfile ?? false;
    const customFormatId = options?.formatId;

    let profileLabel: 'default' | 'fallback' | 'custom' = 'default';
    let format: string;

    if (customFormatId) {
      profileLabel = 'custom';
      format = customFormatId;
    } else if (useFallbackProfile) {
      profileLabel = 'fallback';
      format = 'b[height<=720][ext=mp4]/b[height<=720]/b';
    } else {
      profileLabel = 'default';
      format = 'b[ext=mp4]/b';
    }

    const diagnostics: YtDlpStreamDiagnostics = {
      stderrTail: [],
      profile: profileLabel,
    };

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
      format,
      '-o',
      '-',
      url,
    ];

    if (this.config.ffmpegBinaryPath) {
      args.unshift(this.config.ffmpegBinaryPath);
      args.unshift('--ffmpeg-location');
    }

    const binary = this.config.ytDlpBinaryPath || 'yt-dlp';
    diagnostics.command = `${binary} ${args.join(' ')}`;

    const processStream = new PassThrough();
    const child = spawn(binary, args, {
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
        `yt-dlp process error (profile=${diagnostics.profile}): ${String(error)}`,
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

  async getAvailableProfiles(url: string): Promise<AvailableProfile[]> {
    const metadata = (await this.getMetadata(url)) as any;
    if (!metadata) {
      this.logger.warn(`No metadata returned for URL: ${url}`);
      return [];
    }

    if (!Array.isArray(metadata.formats)) {
      this.logger.warn(
        `No formats array in metadata for URL: ${url}. ` +
          `Title: ${metadata.title || 'unknown'}, ` +
          `Keys: ${Object.keys(metadata).slice(0, 10).join(', ')}`,
      );
      return [];
    }

    const profiles: AvailableProfile[] = [];
    const seen = new Set<string>();

    // Recommend best merged format (video+audio)
    const best = metadata.formats.find(
      (f: any) => f.format_id === metadata.format_id,
    );

    if (best) {
      const key = `${best.format_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Use actual filesize from yt-dlp, not estimates
        const size = this.getActualFormatSize(best, metadata);
        profiles.push({
          id: best.format_id,
          label: this.formatLabel(best),
          format: best.format_id,
          resolution: best.height ? `${best.height}p` : undefined,
          codec: best.vcodec ? this.cleanCodec(best.vcodec) : undefined,
          audioCodec: best.acodec ? this.cleanCodec(best.acodec) : undefined,
          estimatedSize: size,
          isAudioOnly: false,
        });
      }
    }

    // Add common video quality tiers using smarter detection
    // Look for the best video format at each resolution, prefer formats that include audio
    for (const height of [720, 480, 360]) {
      const candidates = metadata.formats.filter(
        (f: any) =>
          f.vcodec &&
          f.vcodec !== 'none' &&
          f.height === height &&
          f.ext === 'mp4',
      );

      if (candidates.length === 0) continue;

      // Sort by: prioritize if has audio, then bitrate, then filesize
      const tier = candidates.sort((a: any, b: any) => {
        const aHasAudio = a.acodec && a.acodec !== 'none' ? 1 : 0;
        const bHasAudio = b.acodec && b.acodec !== 'none' ? 1 : 0;
        if (aHasAudio !== bHasAudio) return bHasAudio - aHasAudio;

        const aBitrate = a.abr || a.tbr || 0;
        const bBitrate = b.abr || b.tbr || 0;
        if (aBitrate !== bBitrate) return bBitrate - aBitrate;

        return (b.filesize || 0) - (a.filesize || 0);
      })[0];

      const key = `video_${height}p`;
      if (!seen.has(key)) {
        seen.add(key);
        // Use actual filesize from yt-dlp's format data
        const size = this.getActualFormatSize(tier, metadata);
        const hasAudio = tier.acodec && tier.acodec !== 'none';
        profiles.push({
          id: tier.format_id,
          label: hasAudio ? `${height}p with audio` : `${height}p video only`,
          format: tier.format_id,
          resolution: `${height}p`,
          codec: this.cleanCodec(tier.vcodec),
          audioCodec: hasAudio ? this.cleanCodec(tier.acodec) : undefined,
          estimatedSize: size,
          isAudioOnly: false,
        });
      }
    }

    // Add audio-only option (best audio available)
    const audioOnlyCandidates = metadata.formats.filter(
      (f: any) =>
        (!f.vcodec || f.vcodec === 'none') && f.acodec && f.acodec !== 'none',
    );

    if (audioOnlyCandidates.length > 0) {
      const audioOnly = audioOnlyCandidates.sort(
        (a: any, b: any) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0),
      )[0];

      const key = `audio_only`;
      if (!seen.has(key)) {
        seen.add(key);
        // Use actual filesize from yt-dlp's format data
        const size = this.getActualFormatSize(audioOnly, metadata);
        profiles.push({
          id: audioOnly.format_id,
          label: `Audio only (${audioOnly.ext})`,
          format: audioOnly.format_id,
          resolution: undefined,
          codec: undefined,
          audioCodec: this.cleanCodec(audioOnly.acodec),
          estimatedSize: size,
          isAudioOnly: true,
        });
      }
    }

    return profiles;
  }

  async getFormatSize(url: string, formatId: string): Promise<number> {
    const metadata = (await this.getMetadata(url)) as any;
    if (!metadata || !Array.isArray(metadata.formats)) {
      return 0;
    }

    const format = metadata.formats.find((f: any) => f.format_id === formatId);
    return format ? this.getActualFormatSize(format, metadata) : 0;
  }

  private getActualFormatSize(format: any, metadata: any): number {
    // Priority 1: Use yt-dlp's direct filesize or filesize_approx on format
    if (typeof format.filesize === 'number' && format.filesize > 0) {
      return format.filesize;
    }
    if (
      typeof format.filesize_approx === 'number' &&
      format.filesize_approx > 0
    ) {
      return format.filesize_approx;
    }

    // Priority 2: Get parent filesize_approx and scale by resolution
    let parentSize = 0;
    if (
      typeof metadata.filesize_approx === 'number' &&
      metadata.filesize_approx > 0
    ) {
      parentSize = metadata.filesize_approx;
    } else if (
      Array.isArray(metadata.requested_downloads) &&
      metadata.requested_downloads[0] &&
      typeof metadata.requested_downloads[0].filesize_approx === 'number'
    ) {
      parentSize = metadata.requested_downloads[0].filesize_approx;
    } else if (typeof metadata.filesize === 'number' && metadata.filesize > 0) {
      parentSize = metadata.filesize;
    }

    // If we have a parent size, scale it by resolution ratio
    if (parentSize > 0) {
      // Assume parent is the best/highest quality format
      // Resolution ratio: if target height is 720p and parent is 1080p, it's (720/1080)^2 for bitrate
      const bestHeight = metadata.height || 1080;
      const thisHeight = format.height || 720;

      if (bestHeight > 0 && thisHeight > 0) {
        // Bitrate scales with resolution squared in video compression
        // But commonly used is linear scaling for practical estimates
        const heightRatio = thisHeight / bestHeight;
        const scaled = Math.round(parentSize * heightRatio * 0.85); // 0.85 = slight compression bonus for lower res
        if (scaled > 0) return scaled;
      }
    }

    // Priority 3: Calculate from bitrate if available
    const bitratekbps = format.tbr || format.abr || format.vbr || 0;
    const duration = format.duration || metadata.duration || 0;

    if (bitratekbps > 0 && duration > 0) {
      // bitrate in kbps, convert to bytes: (kbps * 1000 bits/byte) / 8 = bytes/sec, * duration = total bytes
      const sizeBytes = Math.round((bitratekbps * 1000 * duration) / 8);
      if (sizeBytes > 0) return sizeBytes;
    }

    // DEBUG: Fallback - log what we're missing
    if (!parentSize && !bitratekbps && !format.filesize_approx) {
      this.logger.debug({
        msg: 'No size data in format - using zero',
        formatId: format.format_id,
        h: format.height,
        parentH: metadata.height,
        ext: format.ext,
      });
    }

    return 0;
  }

  private formatLabel(format: any): string {
    const parts: string[] = [];

    if (format.height) {
      parts.push(`${format.height}p`);
    }

    if (format.vcodec && format.vcodec !== 'none') {
      parts.push(`${this.cleanCodec(format.vcodec)}`);
    }

    if (format.acodec && format.acodec !== 'none') {
      parts.push(`${this.cleanCodec(format.acodec)}`);
    }

    if (format.ext) {
      parts.push(`${format.ext.toUpperCase()}`);
    }

    return parts.length > 0 ? parts.join(' · ') : 'Default';
  }

  private cleanCodec(codec: string): string {
    // Convert h264 → H.264, vp9 → VP9, etc.
    const map: Record<string, string> = {
      h264: 'H.264',
      h265: 'H.265',
      vp9: 'VP9',
      av1: 'AV1',
      opus: 'Opus',
      aac: 'AAC',
      mp3: 'MP3',
      vorbis: 'Vorbis',
    };

    const lower = codec.toLowerCase();
    return map[lower] || codec.toUpperCase();
  }
}
