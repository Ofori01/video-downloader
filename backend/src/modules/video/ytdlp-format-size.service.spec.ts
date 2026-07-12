import { YtDlpFormatSizeService } from './ytdlp-format-size.service';
import { YtDlpMetadata } from './ytdlp.types';

describe('YtDlpFormatSizeService', () => {
  const metadata: YtDlpMetadata = {
    height: 1080,
    duration: 100,
    requestedDownloads: [],
    formats: [],
  };

  const service = new YtDlpFormatSizeService();

  it('uses direct format filesize first', () => {
    expect(
      service.getActualFormatSize(
        { filesize: 1234, filesizeApprox: 999 },
        metadata,
      ),
    ).toBe(1234);
  });

  it('uses approximate format filesize when direct filesize is missing', () => {
    expect(service.getActualFormatSize({ filesizeApprox: 999 }, metadata)).toBe(
      999,
    );
  });

  it('scales parent size by height when format size is missing', () => {
    expect(
      service.getActualFormatSize(
        { height: 720 },
        { ...metadata, filesizeApprox: 1_000_000 },
      ),
    ).toBe(566667);
  });

  it('estimates size from bitrate and duration as a fallback', () => {
    expect(service.getActualFormatSize({ tbr: 800 }, metadata)).toBe(
      10_000_000,
    );
  });
});
