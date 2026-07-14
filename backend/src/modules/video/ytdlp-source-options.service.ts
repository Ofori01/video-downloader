import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { SourceSiteDetectorService } from './source-site-detector.service';

export interface YtDlpSourceMetadataOptions {
  extractorRetries?: number;
  forceIpv4?: boolean;
  retries?: number;
  retrySleep?: string;
  sleepRequests?: number;
}

@Injectable()
export class YtDlpSourceOptionsService {
  constructor(
    private readonly config: AppConfigService,
    private readonly sourceDetector: SourceSiteDetectorService,
  ) {}

  getDownloadArgs(url: string): string[] {
    if (this.sourceDetector.detect(url) !== 'instagram') {
      return [];
    }

    return [
      '--sleep-requests',
      String(this.config.instagramYtDlpSleepRequestsSeconds),
      '--retry-sleep',
      this.config.instagramYtDlpRetrySleep,
    ];
  }

  getMetadataOptions(url: string): YtDlpSourceMetadataOptions {
    if (this.sourceDetector.detect(url) !== 'instagram') {
      return {};
    }

    return {
      extractorRetries: 1,
      forceIpv4: true,
      retries: 1,
      retrySleep: this.config.instagramYtDlpRetrySleep,
      sleepRequests: this.config.instagramYtDlpSleepRequestsSeconds,
    };
  }
}
