import { YtDlpStreamCommandBuilder } from './ytdlp-stream-command.service';

describe('YtDlpStreamCommandBuilder', () => {
  it('builds the yt-dlp stream command with configured binaries', () => {
    const builder = new YtDlpStreamCommandBuilder({
      ytDlpBinaryPath: '/usr/local/bin/yt-dlp',
      ffmpegBinaryPath: '/usr/bin/ffmpeg',
    } as never);

    const command = builder.buildStreamCommand('https://example.com/video', {
      format: '18',
      profile: 'custom',
    });

    expect(command.binary).toBe('/usr/local/bin/yt-dlp');
    expect(command.profile).toBe('custom');
    expect(command.args).toEqual([
      '--ffmpeg-location',
      '/usr/bin/ffmpeg',
      '--no-playlist',
      '--newline',
      '--socket-timeout',
      '20',
      '--retries',
      '1',
      '--fragment-retries',
      '1',
      '--extractor-retries',
      '1',
      '--force-ipv4',
      '-f',
      '18',
      '-o',
      '-',
      'https://example.com/video',
    ]);
  });

  it('falls back to the yt-dlp binary name when no binary path is configured', () => {
    const builder = new YtDlpStreamCommandBuilder({
      ytDlpBinaryPath: '',
      ffmpegBinaryPath: '',
    } as never);

    expect(
      builder.buildStreamCommand('https://example.com/video', {
        format: 'b[ext=mp4]/b',
        profile: 'default',
      }).binary,
    ).toBe('yt-dlp');
  });
});
