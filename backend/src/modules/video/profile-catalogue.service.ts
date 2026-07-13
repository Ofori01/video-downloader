import { Inject, Injectable, Logger } from '@nestjs/common';
import { inferDownloadOutput } from './download-output';
import { VIDEO_METADATA_CLIENT } from './video-metadata-client';
import type { VideoMetadataClient } from './video-metadata-client';
import { formatHasAudio, formatHasVideo } from './ytdlp-format-capabilities';
import { YtDlpFormatSizeService } from './ytdlp-format-size.service';
import { AvailableProfile, YtDlpFormat, YtDlpMetadata } from './ytdlp.types';

@Injectable()
export class ProfileCatalogueService {
  private readonly logger = new Logger(ProfileCatalogueService.name);

  constructor(
    private readonly formatSize: YtDlpFormatSizeService,
    @Inject(VIDEO_METADATA_CLIENT)
    private readonly metadataClient: VideoMetadataClient,
  ) {}

  async getAvailableProfiles(url: string): Promise<AvailableProfile[]> {
    const metadata = await this.metadataClient.getMetadata(url);
    if (!metadata) {
      this.logger.warn(`No metadata returned for URL: ${url}`);
      return [];
    }

    const playableMetadata = this.selectPlayableMetadata(metadata);
    if (!playableMetadata) {
      this.logger.warn(
        `No formats array in metadata for URL: ${url}. Title: ${
          metadata.title ?? 'unknown'
        }`,
      );
      return [];
    }

    return this.buildProfiles(playableMetadata);
  }

  async getProfile(
    url: string,
    profileId: string,
  ): Promise<AvailableProfile | null> {
    const metadata = await this.metadataClient.getMetadata(url);
    if (!metadata) {
      return null;
    }

    const playableMetadata = this.selectPlayableMetadata(metadata);
    if (!playableMetadata) {
      return null;
    }

    return (
      this.buildProfiles(playableMetadata).find(
        (profile) => profile.id === profileId || profile.format === profileId,
      ) ?? null
    );
  }

  async getFormatSize(url: string, formatId: string): Promise<number> {
    const metadata = await this.metadataClient.getMetadata(url);
    if (!metadata) {
      return 0;
    }

    const playableMetadata = this.selectPlayableMetadata(metadata);
    if (!playableMetadata) {
      return 0;
    }

    const format = playableMetadata.formats.find(
      (item) => item.formatId === formatId,
    );
    return format
      ? this.formatSize.getActualFormatSize(format, playableMetadata)
      : 0;
  }

  private selectPlayableMetadata(
    metadata: YtDlpMetadata,
  ): YtDlpMetadata | null {
    if (metadata.formats.length > 0) {
      return metadata;
    }

    return metadata.entries?.find((entry) => entry.formats.length > 0) ?? null;
  }

  private buildProfiles(metadata: YtDlpMetadata): AvailableProfile[] {
    const profiles: AvailableProfile[] = [];
    const seen = new Set<string>();

    const best = metadata.formats.find(
      (format) =>
        format.formatId === metadata.formatId &&
        this.isSupportedDirectFormat(format),
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

    if (!this.isSupportedDirectFormat(format)) {
      return;
    }

    const keys = [seenKey, format.formatId].filter((value): value is string =>
      Boolean(value),
    );
    if (keys.some((key) => seen.has(key))) {
      return;
    }

    keys.forEach((key) => seen.add(key));
    const hasAudio = this.hasAudio(format);
    const hasVideo = this.hasVideo(format);
    const output = inferDownloadOutput(format);
    profiles.push({
      id: format.formatId,
      label: overrides?.label ?? this.formatLabel(format),
      format: format.formatId,
      ext: output.extension,
      contentType: output.contentType,
      mediaKind: output.mediaKind,
      resolution:
        overrides?.resolution ??
        (format.height ? `${format.height}p` : undefined),
      codec: this.getCodecLabel(format.vcodec),
      audioCodec: this.getCodecLabel(format.acodec),
      estimatedSize: this.formatSize.getActualFormatSize(format, metadata),
      hasAudio,
      hasVideo,
      isAudioOnly: overrides?.isAudioOnly ?? (!hasVideo && hasAudio),
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
          this.hasAudio(format) &&
          format.height === height &&
          format.ext === 'mp4',
      )
      .sort((a, b) => {
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

    return `${height}p with audio`;
  }

  private formatLabel(format: YtDlpFormat): string {
    const parts: string[] = [];

    if (format.height) {
      parts.push(`${format.height}p`);
    }

    const videoCodec = this.getCodecLabel(format.vcodec);
    if (videoCodec) {
      parts.push(videoCodec);
    }

    const audioCodec = this.getCodecLabel(format.acodec);
    if (audioCodec) {
      parts.push(audioCodec);
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

  private getCodecLabel(codec: string | undefined): string | undefined {
    if (!codec || codec === 'none') {
      return undefined;
    }

    return this.cleanCodec(codec);
  }

  private hasVideo(format: YtDlpFormat): boolean {
    return formatHasVideo(format);
  }

  private hasAudio(format: YtDlpFormat): boolean {
    return formatHasAudio(format);
  }

  private isSupportedDirectFormat(format: YtDlpFormat): boolean {
    const hasVideo = this.hasVideo(format);
    const hasAudio = this.hasAudio(format);
    return (hasVideo && hasAudio) || (!hasVideo && hasAudio);
  }
}
