import {
  buildDownloadObjectKey,
  coerceDownloadOutput,
  inferDownloadOutput,
} from './download-output';

describe('download output metadata', () => {
  it('infers video/mp4 for muxed MP4 formats', () => {
    expect(
      inferDownloadOutput({
        ext: 'mp4',
        vcodec: 'h264',
        acodec: 'aac',
      }),
    ).toEqual({
      mediaKind: 'video',
      extension: 'mp4',
      contentType: 'video/mp4',
    });
  });

  it('infers video/mp4 for direct MP4 formats with missing codec fields', () => {
    expect(
      inferDownloadOutput({
        ext: 'mp4',
        protocol: 'https',
        hasUrl: true,
        height: 1024,
      }),
    ).toEqual({
      mediaKind: 'video',
      extension: 'mp4',
      contentType: 'video/mp4',
    });
  });

  it('infers audio/mp4 for m4a audio-only formats', () => {
    expect(
      inferDownloadOutput({
        ext: 'm4a',
        vcodec: 'none',
        acodec: 'aac',
      }),
    ).toEqual({
      mediaKind: 'audio',
      extension: 'm4a',
      contentType: 'audio/mp4',
    });
  });

  it('builds media-specific object keys', () => {
    expect(
      buildDownloadObjectKey('file-1', {
        mediaKind: 'audio',
        extension: 'm4a',
        contentType: 'audio/mp4',
      }),
    ).toBe('audio/file-1.m4a');
  });

  it('defaults incomplete legacy job output to MP4 video', () => {
    expect(coerceDownloadOutput(null)).toEqual({
      mediaKind: 'video',
      extension: 'mp4',
      contentType: 'video/mp4',
    });
  });
});
