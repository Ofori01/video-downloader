import { Injectable, Logger } from '@nestjs/common';
import { YtDlpFormat, YtDlpMetadata } from './ytdlp.types';

@Injectable()
export class YtDlpFormatSizeService {
  private readonly logger = new Logger(YtDlpFormatSizeService.name);

  getActualFormatSize(format: YtDlpFormat, metadata: YtDlpMetadata): number {
    if (this.isPositive(format.filesize)) {
      return format.filesize;
    }

    if (this.isPositive(format.filesizeApprox)) {
      return format.filesizeApprox;
    }

    const parentSize = this.getParentSize(metadata);
    if (parentSize > 0) {
      const bestHeight = metadata.height ?? 1080;
      const formatHeight = format.height ?? 720;

      if (bestHeight > 0 && formatHeight > 0) {
        const heightRatio = formatHeight / bestHeight;
        const scaled = Math.round(parentSize * heightRatio * 0.85);
        if (scaled > 0) {
          return scaled;
        }
      }
    }

    const bitrateKbps = format.tbr ?? format.abr ?? format.vbr ?? 0;
    const duration = format.duration ?? metadata.duration ?? 0;

    if (bitrateKbps > 0 && duration > 0) {
      const sizeBytes = Math.round((bitrateKbps * 1000 * duration) / 8);
      if (sizeBytes > 0) {
        return sizeBytes;
      }
    }

    if (!parentSize && !bitrateKbps && !format.filesizeApprox) {
      this.logger.debug({
        msg: 'No size data in format - using zero',
        formatId: format.formatId,
        h: format.height,
        parentH: metadata.height,
        ext: format.ext,
      });
    }

    return 0;
  }

  private getParentSize(metadata: YtDlpMetadata): number {
    if (this.isPositive(metadata.filesizeApprox)) {
      return metadata.filesizeApprox;
    }

    const requestedDownload = metadata.requestedDownloads[0];
    if (this.isPositive(requestedDownload?.filesizeApprox)) {
      return requestedDownload.filesizeApprox;
    }

    if (this.isPositive(metadata.filesize)) {
      return metadata.filesize;
    }

    return 0;
  }

  private isPositive(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }
}
