import { SourceSiteDetectorService } from './source-site-detector.service';

describe('SourceSiteDetectorService', () => {
  const service = new SourceSiteDetectorService();

  it.each([
    ['https://www.instagram.com/reel/abc', 'instagram'],
    ['https://x.com/user/status/1', 'x'],
    ['https://twitter.com/user/status/1', 'x'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://example.com/video', 'generic'],
    ['not-a-url', 'generic'],
  ] as const)('detects %s as %s', (url, expected) => {
    expect(service.detect(url)).toBe(expected);
  });
});
