import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ProfileCatalogueService } from './profile-catalogue.service';
import { VIDEO_METADATA_CLIENT } from './video-metadata-client';
import type { VideoMetadataClient } from './video-metadata-client';
import { YtDlpMetadata } from './ytdlp.types';

@Injectable()
export class DownloadSizeEstimator {
  constructor(
    @Inject(VIDEO_METADATA_CLIENT)
    private readonly metadataClient: VideoMetadataClient,
    private readonly profileCatalogue: ProfileCatalogueService,
  ) {}

  async estimate(url: string, profileId?: string): Promise<number> {
    if (profileId) {
      const estimatedSize = await this.profileCatalogue.getFormatSize(
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

    const metadata = await this.metadataClient.getMetadata(url);
    const estimatedSize = metadata ? this.estimateFromMetadata(metadata) : 0;

    if (estimatedSize > 0) {
      return estimatedSize;
    }

    throw new BadRequestException(
      metadata?.formats.length
        ? 'Unable to estimate file size - selected format has no size information'
        : 'Unable to estimate file size for this source. Try using the profile selection first.',
    );
  }

  private estimateFromMetadata(metadata: YtDlpMetadata): number {
    const requestedDownload = metadata.requestedDownloads[0];
    const raw =
      metadata.filesize ??
      metadata.filesizeApprox ??
      requestedDownload?.filesize ??
      requestedDownload?.filesizeApprox;

    const parsed = this.parsePositiveNumber(raw);
    if (parsed !== null) {
      return parsed;
    }

    if (metadata.formats.length === 0) {
      return 0;
    }

    const best =
      metadata.formats.find(
        (format) => format.formatId === metadata.formatId,
      ) ?? metadata.formats[0];

    const directSize =
      this.parsePositiveNumber(best.filesize) ??
      this.parsePositiveNumber(best.filesizeApprox);
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

  private parsePositiveNumber(value: unknown): number | null {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return null;
  }
}
