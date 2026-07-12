import { Injectable, Logger } from '@nestjs/common';
import { YtDlpFormatSizeService } from './ytdlp-format-size.service';
import { YtDlpMetadataClient } from './ytdlp-metadata-client.service';
import { AvailableProfile, YtDlpFormat, YtDlpMetadata } from './ytdlp.types';

@Injectable()
export class ProfileCatalogueService {
  private readonly logger = new Logger(ProfileCatalogueService.name);

  constructor(
    private readonly formatSize: YtDlpFormatSizeService,
    private readonly metadataClient: YtDlpMetadataClient,
  ) {}

  async getAvailableProfiles(url: string): Promise<AvailableProfile[]> {
    const metadata = await this.metadataClient.getMetadata(url);
    if (!metadata) {
      this.logger.warn(`No metadata returned for URL: ${url}`);
      return [];
    }

    if (metadata.formats.length === 0) {
      this.logger.warn(
        `No formats array in metadata for URL: ${url}. Title: ${
          metadata.title ?? 'unknown'
        }`,
      );
      return [];
    }

    return this.buildProfiles(metadata);
  }

  async getFormatSize(url: string, formatId: string): Promise<number> {
    const metadata = await this.metadataClient.getMetadata(url);
    if (!metadata) {
      return 0;
    }

    const format = metadata.formats.find((item) => item.formatId === formatId);
    return format ? this.formatSize.getActualFormatSize(format, metadata) : 0;
  }

  private buildProfiles(metadata: YtDlpMetadata): AvailableProfile[] {
    const profiles: AvailableProfile[] = [];
    const seen = new Set<string>();

    const best = metadata.formats.find(
      (format) => format.formatId === metadata.formatId,
    );
    this.pushProfile(profiles, seen, metadata, best);

    for (const height of [720, 480, 360]) {
      const tier = this.findBestVideoTier(metadata.formats, height);
      this.pushProfile(profiles, seen, metadata, tier, `video_${height}p`, {
        label: this.formatTierLabel(height, tier),
        resolution: `${height}p`,
      });
    }

    const audioOnly = this.findBestAudioOnly(metadata.formats);
    this.pushProfile(profiles, seen, metadata, audioOnly, 'audio_only', {
      label: audioOnly ? `Audio only (${audioOnly.ext ?? 'audio'})` : undefined,
      isAudioOnly: true,
    });

    return profiles;
  }

  private pushProfile(
    profiles: AvailableProfile[],
    seen: Set<string>,
    metadata: YtDlpMetadata,
    format: YtDlpFormat | undefined,
    seenKey?: string,
    overrides?: Partial<AvailableProfile>,
  ): void {
    if (!format?.formatId) {
      return;
    }

    const key = seenKey ?? format.formatId;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    const hasAudio = this.hasAudio(format);
    profiles.push({
      id: format.formatId,
      label: overrides?.label ?? this.formatLabel(format),
      format: format.formatId,
      resolution:
        overrides?.resolution ??
        (format.height ? `${format.height}p` : undefined),
      codec: format.vcodec ? this.cleanCodec(format.vcodec) : undefined,
      audioCodec: hasAudio ? this.cleanCodec(format.acodec ?? '') : undefined,
      estimatedSize: this.formatSize.getActualFormatSize(format, metadata),
      isAudioOnly: overrides?.isAudioOnly ?? false,
    });
  }

  private findBestVideoTier(
    formats: YtDlpFormat[],
    height: number,
  ): YtDlpFormat | undefined {
    return formats
      .filter(
        (format) =>
          this.hasVideo(format) &&
          format.height === height &&
          format.ext === 'mp4',
      )
      .sort((a, b) => {
        const aHasAudio = this.hasAudio(a) ? 1 : 0;
        const bHasAudio = this.hasAudio(b) ? 1 : 0;
        if (aHasAudio !== bHasAudio) {
          return bHasAudio - aHasAudio;
        }

        const aBitrate = a.abr ?? a.tbr ?? 0;
        const bBitrate = b.abr ?? b.tbr ?? 0;
        if (aBitrate !== bBitrate) {
          return bBitrate - aBitrate;
        }

        return (b.filesize ?? 0) - (a.filesize ?? 0);
      })[0];
  }

  private findBestAudioOnly(formats: YtDlpFormat[]): YtDlpFormat | undefined {
    return formats
      .filter((format) => !this.hasVideo(format) && this.hasAudio(format))
      .sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0))[0];
  }

  private formatTierLabel(
    height: number,
    format: YtDlpFormat | undefined,
  ): string | undefined {
    if (!format) {
      return undefined;
    }

    return this.hasAudio(format)
      ? `${height}p with audio`
      : `${height}p video only`;
  }

  private formatLabel(format: YtDlpFormat): string {
    const parts: string[] = [];

    if (format.height) {
      parts.push(`${format.height}p`);
    }

    if (this.hasVideo(format)) {
      parts.push(this.cleanCodec(format.vcodec ?? ''));
    }

    if (this.hasAudio(format)) {
      parts.push(this.cleanCodec(format.acodec ?? ''));
    }

    if (format.ext) {
      parts.push(format.ext.toUpperCase());
    }

    return parts.length > 0 ? parts.join(' · ') : 'Default';
  }

  private cleanCodec(codec: string): string {
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
    return map[lower] ?? codec.toUpperCase();
  }

  private hasVideo(format: YtDlpFormat): boolean {
    return Boolean(format.vcodec && format.vcodec !== 'none');
  }

  private hasAudio(format: YtDlpFormat): boolean {
    return Boolean(format.acodec && format.acodec !== 'none');
  }
}
