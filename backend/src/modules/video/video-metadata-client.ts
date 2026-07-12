import type { YtDlpMetadata } from './ytdlp.types';

export const VIDEO_METADATA_CLIENT = Symbol('VIDEO_METADATA_CLIENT');

export interface VideoMetadataClient {
  getMetadata(url: string): Promise<YtDlpMetadata | null>;
}
