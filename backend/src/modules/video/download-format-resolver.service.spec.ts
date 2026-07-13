import {
  DEFAULT_MERGED_MP4_FORMAT,
  DownloadFormatResolver,
  FALLBACK_MERGED_MP4_FORMAT,
} from './download-format-resolver.service';

describe('DownloadFormatResolver', () => {
  const resolver = new DownloadFormatResolver();

  it('uses the selected format when provided', () => {
    expect(resolver.resolve({ formatId: '18', fallbackProfile: true })).toEqual(
      {
        format: '18',
        profile: 'custom',
        requiresFileOutput: false,
      },
    );
  });

  it('uses file output for selected merged formats', () => {
    expect(
      resolver.resolve({
        formatId: 'dash-video+dash-audio',
      }),
    ).toEqual({
      format: 'dash-video+dash-audio',
      profile: 'custom',
      requiresFileOutput: true,
    });
  });

  it('uses the fallback profile on retry when no custom format is selected', () => {
    expect(resolver.resolve({ fallbackProfile: true })).toEqual({
      format: FALLBACK_MERGED_MP4_FORMAT,
      profile: 'fallback',
      requiresFileOutput: true,
    });
  });

  it('uses the default mp4-oriented profile by default', () => {
    expect(resolver.resolve()).toEqual({
      format: DEFAULT_MERGED_MP4_FORMAT,
      profile: 'default',
      requiresFileOutput: true,
    });
  });
});
