import { Injectable } from '@nestjs/common';
import { GENERIC_SOURCE_BUSY_MESSAGE } from './source-failure';

export type YtDlpFailureCode =
  | 'source_rate_limited'
  | 'source_auth_required'
  | 'source_unavailable'
  | 'source_download_failed';

export interface YtDlpFailureClassification {
  code: YtDlpFailureCode;
  retryable: boolean;
  userMessage: string;
}

export interface ClassifyYtDlpFailureInput {
  stderrTail: string[];
  error?: unknown;
}

@Injectable()
export class YtDlpErrorClassifierService {
  classify(input: ClassifyYtDlpFailureInput): YtDlpFailureClassification {
    const text = this.buildSearchText(input);

    if (/(http error 429|too many requests|rate[- ]?limit)/i.test(text)) {
      return this.createClassification('source_rate_limited', false);
    }

    if (/(login required|sign in|cookies|authentication|private)/i.test(text)) {
      return this.createClassification('source_auth_required', false);
    }

    if (/(not available|unavailable|removed|deleted|copyright)/i.test(text)) {
      return this.createClassification('source_unavailable', false);
    }

    return this.createClassification('source_download_failed', true);
  }

  private createClassification(
    code: YtDlpFailureCode,
    retryable: boolean,
  ): YtDlpFailureClassification {
    return {
      code,
      retryable,
      userMessage: GENERIC_SOURCE_BUSY_MESSAGE,
    };
  }

  private buildSearchText(input: ClassifyYtDlpFailureInput): string {
    const errorText = this.formatErrorText(input.error);

    return [...input.stderrTail, errorText].join('\n');
  }

  private formatErrorText(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return '';
  }
}
