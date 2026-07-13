import { Injectable } from '@nestjs/common';
import { YtDlpStreamProfile } from './ytdlp.types';

export interface DownloadFormatRequest {
  fallbackProfile?: boolean;
  formatId?: string;
}

export interface ResolvedDownloadFormat {
  format: string;
  profile: YtDlpStreamProfile;
}

@Injectable()
export class DownloadFormatResolver {
  resolve(request: DownloadFormatRequest = {}): ResolvedDownloadFormat {
    if (request.formatId) {
      return {
        format: request.formatId,
        profile: 'custom',
      };
    }

    if (request.fallbackProfile) {
      return {
        format: 'b[height<=720][ext=mp4]/b[height<=720]/b',
        profile: 'fallback',
      };
    }

    return {
      format: 'b[ext=mp4]/b',
      profile: 'default',
    };
  }
}
