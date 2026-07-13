import { Inject, Injectable, Logger } from '@nestjs/common';
import { inferDownloadOutput } from './download-output';
import { VIDEO_METADATA_CLIENT } from './video-metadata-client';
import type { VideoMetadataClient } from './video-metadata-client';
import { formatHasAudio, formatHasVideo } from './ytdlp-format-capabilities';
import { YtDlpFormatSizeService } from './ytdlp-format-size.service';
import { AvailableProfile, YtDlpFormat, YtDlpMetadata } from './ytdlp.types';

const MAX_VIDEO_PROFILES = 5;
const MP4_MERGE_AUDIO_EXTENSIONS = ['aac', 'm4a', 'mp4'];

interface ProfileFormatSelection {
  format: YtDlpFormat;
  seenKey?: string;
  overrides?: Partial<AvailableProfile>;
}

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

    const profile = this.buildProfiles(playableMetadata).find(
      (item) => item.id === formatId || item.format === formatId,
    );
    if (profile) {
      return Number(profile.estimatedSize ?? 0);
    }

    const rawFormat = playableMetadata.formats.find(
      (item) => item.formatId === formatId,
    );
    return rawFormat
      ? this.formatSize.getActualFormatSize(rawFormat, playableMetadata)
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

    this.getVideoSelections(metadata)
      .slice(0, MAX_VIDEO_PROFILES)
      .forEach((selection) =>
        this.pushProfile(
          profiles,
          seen,
          metadata,
          selection.format,
          selection.seenKey,
          selection.overrides,
        ),
      );

    const audioOnly = this.findBestAudioOnly(metadata.formats);
    this.pushProfile(profiles, seen, metadata, audioOnly, 'audio_only', {
      label: audioOnly ? `Audio only (${audioOnly.ext ?? 'audio'})` : undefined,
      isAudioOnly: true,
    });

    return profiles;
  }

  private getVideoSelections(
    metadata: YtDlpMetadata,
  ): ProfileFormatSelection[] {
    const candidates = [
      ...this.getMuxedVideoSelections(metadata),
      ...this.getMergedVideoSelections(metadata),
    ].sort((a, b) => this.compareVideoQuality(b.format, a.format));

    const selected: ProfileFormatSelection[] = [];
    const seenResolution = new Set<string>();

    for (const candidate of candidates) {
      const key = this.videoResolutionKey(candidate.format);
      if (seenResolution.has(key)) {
        continue;
      }

      seenResolution.add(key);
      selected.push(candidate);
    }

    return selected;
  }

  private getMuxedVideoSelections(
    metadata: YtDlpMetadata,
  ): ProfileFormatSelection[] {
    return metadata.formats
      .filter((format) => this.isMuxedVideoFormat(format))
      .map((format) => ({
        format,
        seenKey: this.profileSeenKey(format),
      }));
  }

  private getMergedVideoSelections(
    metadata: YtDlpMetadata,
  ): ProfileFormatSelection[] {
    const audio = this.findBestMp4MergeAudio(metadata.formats);
    if (!audio) {
      return [];
    }

    return metadata.formats
      .filter((format) => this.isMergeableVideoFormat(format))
      .map((video) => this.createMergedSelection(metadata, video, audio))
      .filter(
        (selection): selection is ProfileFormatSelection => selection !== null,
      );
  }

  private createMergedSelection(
    metadata: YtDlpMetadata,
    video: YtDlpFormat,
    audio: YtDlpFormat,
  ): ProfileFormatSelection | null {
    if (!video.formatId || !audio.formatId) {
      return null;
    }

    const mergedFormat: YtDlpFormat = {
      formatId: `${video.formatId}+${audio.formatId}`,
      ext: 'mp4',
      height: video.height,
      vcodec: video.vcodec,
      acodec: audio.acodec,
      tbr: this.sumPositive(video.tbr ?? video.vbr, audio.abr ?? audio.tbr),
      abr: audio.abr ?? audio.tbr,
      vbr: video.vbr ?? video.tbr,
      duration: video.duration ?? audio.duration ?? metadata.duration,
      filesize: this.sumSizes(video.filesize, audio.filesize),
      filesizeApprox: this.sumSizes(
        video.filesizeApprox ?? video.filesize,
        audio.filesizeApprox ?? audio.filesize,
      ),
    };

    return {
      format: mergedFormat,
      seenKey: `merged:${mergedFormat.formatId}`,
      overrides: {
        label: this.formatMergedLabel(mergedFormat),
        resolution: this.formatResolution(mergedFormat),
        isAudioOnly: false,
      },
    };
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

    if (!this.isSupportedProfileFormat(format)) {
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

  private findBestMp4MergeAudio(
    formats: YtDlpFormat[],
  ): YtDlpFormat | undefined {
    return formats
      .filter(
        (format) =>
          !this.hasVideo(format) &&
          this.hasAudio(format) &&
          MP4_MERGE_AUDIO_EXTENSIONS.includes(format.ext ?? ''),
      )
      .sort((a, b) => this.compareAudioQuality(b, a))[0];
  }

  private findBestAudioOnly(formats: YtDlpFormat[]): YtDlpFormat | undefined {
    return formats
      .filter((format) => !this.hasVideo(format) && this.hasAudio(format))
      .sort((a, b) => this.compareAudioQuality(b, a))[0];
  }

  private formatMergedLabel(format: YtDlpFormat): string {
    return `${this.formatResolution(format) ?? 'Video'} with audio`;
  }

  private formatLabel(format: YtDlpFormat): string {
    const parts: string[] = [];

    const resolution = this.formatResolution(format);
    if (resolution) {
      parts.push(resolution);
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

  private isSupportedProfileFormat(format: YtDlpFormat): boolean {
    const hasVideo = this.hasVideo(format);
    const hasAudio = this.hasAudio(format);
    return (hasVideo && hasAudio) || (!hasVideo && hasAudio);
  }

  private isMuxedVideoFormat(format: YtDlpFormat): boolean {
    return (
      this.hasVideo(format) && this.hasAudio(format) && format.ext === 'mp4'
    );
  }

  private isMergeableVideoFormat(format: YtDlpFormat): boolean {
    return (
      this.hasVideo(format) &&
      !this.hasAudio(format) &&
      format.ext === 'mp4' &&
      Boolean(format.formatId)
    );
  }

  private compareVideoQuality(a: YtDlpFormat, b: YtDlpFormat): number {
    const heightDelta = (a.height ?? 0) - (b.height ?? 0);
    if (heightDelta !== 0) {
      return heightDelta;
    }

    const bitrateDelta = this.formatBitrate(a) - this.formatBitrate(b);
    if (bitrateDelta !== 0) {
      return bitrateDelta;
    }

    return this.formatSizeValue(a) - this.formatSizeValue(b);
  }

  private compareAudioQuality(a: YtDlpFormat, b: YtDlpFormat): number {
    const bitrateDelta = (a.abr ?? a.tbr ?? 0) - (b.abr ?? b.tbr ?? 0);
    if (bitrateDelta !== 0) {
      return bitrateDelta;
    }

    return this.formatSizeValue(a) - this.formatSizeValue(b);
  }

  private formatBitrate(format: YtDlpFormat): number {
    return format.tbr ?? this.sumPositive(format.vbr, format.abr) ?? 0;
  }

  private formatSizeValue(format: YtDlpFormat): number {
    return format.filesize ?? format.filesizeApprox ?? 0;
  }

  private formatResolution(format: YtDlpFormat): string | undefined {
    return format.height ? `${format.height}p` : undefined;
  }

  private profileSeenKey(format: YtDlpFormat): string | undefined {
    return format.formatId ? `format:${format.formatId}` : undefined;
  }

  private videoResolutionKey(format: YtDlpFormat): string {
    return format.height
      ? `height:${format.height}`
      : `format:${format.formatId}`;
  }

  private sumPositive(
    first: number | undefined,
    second: number | undefined,
  ): number | undefined {
    const total = [first, second]
      .filter((value): value is number => this.isPositive(value))
      .reduce((sum, value) => sum + value, 0);

    return total > 0 ? total : undefined;
  }

  private sumSizes(
    first: number | undefined,
    second: number | undefined,
  ): number | undefined {
    if (!this.isPositive(first) && !this.isPositive(second)) {
      return undefined;
    }

    return (first ?? 0) + (second ?? 0);
  }

  private isPositive(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }
}
