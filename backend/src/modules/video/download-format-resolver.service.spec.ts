import { DownloadFormatResolver } from './download-format-resolver.service';

describe('DownloadFormatResolver', () => {
  const resolver = new DownloadFormatResolver();

  it('uses the selected format when provided', () => {
    expect(resolver.resolve({ formatId: '18', fallbackProfile: true })).toEqual(
      {
        format: '18',
        profile: 'custom',
      },
    );
  });

  it('uses the fallback profile on retry when no custom format is selected', () => {
    expect(resolver.resolve({ fallbackProfile: true })).toEqual({
      format: 'b[height<=720][ext=mp4]/b[height<=720]/b',
      profile: 'fallback',
    });
  });

  it('uses the default mp4-oriented profile by default', () => {
    expect(resolver.resolve()).toEqual({
      format: 'b[ext=mp4]/b',
      profile: 'default',
    });
  });
});
