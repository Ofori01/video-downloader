import { BadRequestException, Injectable } from '@nestjs/common';
import { YtDlpService } from './ytdlp.service';

interface YtDlpRequestedDownload {
  filesize?: unknown;
  filesize_approx?: unknown;
}

interface YtDlpFormat {
  format_id?: unknown;
  filesize?: unknown;
  filesize_approx?: unknown;
  tbr?: unknown;
  abr?: unknown;
  vbr?: unknown;
  duration?: unknown;
}

interface YtDlpMetadata {
  filesize?: unknown;
  filesize_approx?: unknown;
  requested_downloads?: YtDlpRequestedDownload[];
  formats?: YtDlpFormat[];
  format_id?: unknown;
  duration?: unknown;
}

@Injectable()
export class DownloadSizeEstimator {
  constructor(private readonly ytDlpService: YtDlpService) {}

  async estimate(url: string, profileId?: string): Promise<number> {
    if (profileId) {
      const estimatedSize = await this.ytDlpService.getFormatSize(
        url,
        profileId,
      );

      if (estimatedSize <= 0) {
        throw new BadRequestException(
          'Unable to determine file size for selected format',
        );
      }

      return estimatedSize;
    }

    const metadata = this.asMetadata(await this.ytDlpService.getMetadata(url));
    const estimatedSize = this.estimateFromMetadata(metadata);

    if (estimatedSize > 0) {
      return estimatedSize;
    }

    throw new BadRequestException(
      Array.isArray(metadata.formats)
        ? 'Unable to estimate file size - selected format has no size information'
        : 'Unable to estimate file size for this source. Try using the profile selection first.',
    );
  }

  private estimateFromMetadata(metadata: YtDlpMetadata): number {
    const requestedDownload = metadata.requested_downloads?.[0];
    const raw =
      metadata.filesize ??
      metadata.filesize_approx ??
      requestedDownload?.filesize ??
      requestedDownload?.filesize_approx;

    const parsed = this.parsePositiveNumber(raw);
    if (parsed !== null) {
      return parsed;
    }

    const formats = Array.isArray(metadata.formats) ? metadata.formats : [];
    if (formats.length === 0) {
      return 0;
    }

    const best =
      formats.find((format) => format.format_id === metadata.format_id) ??
      formats[0];

    const directSize =
      this.parsePositiveNumber(best.filesize) ??
      this.parsePositiveNumber(best.filesize_approx);
    if (directSize !== null) {
      return directSize;
    }

    const bitrate =
      this.parsePositiveNumber(best.tbr) ??
      this.parsePositiveNumber(best.abr) ??
      this.parsePositiveNumber(best.vbr) ??
      0;
    const duration =
      this.parsePositiveNumber(best.duration) ??
      this.parsePositiveNumber(metadata.duration) ??
      0;

    if (bitrate > 0 && duration > 0) {
      return Math.round((bitrate * 1000 * duration) / 8);
    }

    return 0;
  }

  private asMetadata(value: unknown): YtDlpMetadata {
    if (!value || typeof value !== 'object') {
      return {};
    }

    return value as YtDlpMetadata;
  }

  private parsePositiveNumber(value: unknown): number | null {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return null;
  }
}
