import { Injectable } from '@nestjs/common';
import { YtDlpStreamProfile } from './ytdlp.types';

export const DEFAULT_MERGED_MP4_FORMAT =
  'bv*[ext=mp4]+ba[ext=m4a]/bv*[ext=mp4]+ba[ext=mp4]/b[ext=mp4]/b';

export const FALLBACK_MERGED_MP4_FORMAT =
  'bv*[height<=720][ext=mp4]+ba[ext=m4a]/bv*[height<=720][ext=mp4]+ba[ext=mp4]/b[height<=720][ext=mp4]/b[height<=720]/b';

export interface DownloadFormatRequest {
  fallbackProfile?: boolean;
  formatId?: string;
}

export interface ResolvedDownloadFormat {
  format: string;
  profile: YtDlpStreamProfile;
  requiresFileOutput: boolean;
}

@Injectable()
export class DownloadFormatResolver {
  resolve(request: DownloadFormatRequest = {}): ResolvedDownloadFormat {
    if (request.formatId) {
      return {
        format: request.formatId,
        profile: 'custom',
        requiresFileOutput: request.formatId.includes('+'),
      };
    }

    if (request.fallbackProfile) {
      return {
        format: FALLBACK_MERGED_MP4_FORMAT,
        profile: 'fallback',
        requiresFileOutput: true,
      };
    }

    return {
      format: DEFAULT_MERGED_MP4_FORMAT,
      profile: 'default',
      requiresFileOutput: true,
    };
  }
}
