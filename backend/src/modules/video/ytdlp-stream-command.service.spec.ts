import { YtDlpStreamCommandBuilder } from './ytdlp-stream-command.service';

describe('YtDlpStreamCommandBuilder', () => {
  const sourceOptions = {
    getDownloadArgs: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sourceOptions.getDownloadArgs.mockReturnValue([]);
  });

  it('builds the yt-dlp stream command with configured binaries', () => {
    const builder = new YtDlpStreamCommandBuilder(
      {
        ytDlpBinaryPath: '/usr/local/bin/yt-dlp',
        ffmpegBinaryPath: '/usr/bin/ffmpeg',
      } as never,
      sourceOptions as never,
    );

    const command = builder.buildStreamCommand('https://example.com/video', {
      format: '18',
      profile: 'custom',
      requiresFileOutput: false,
    });

    expect(command.binary).toBe('/usr/local/bin/yt-dlp');
    expect(command.profile).toBe('custom');
    expect(command.args).toEqual([
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
      '--ffmpeg-location',
      '/usr/bin/ffmpeg',
      '--merge-output-format',
      'mp4',
      '-f',
      '18',
      '-o',
      '-',
      'https://example.com/video',
    ]);
  });

  it('falls back to the yt-dlp binary name when no binary path is configured', () => {
    const builder = new YtDlpStreamCommandBuilder(
      {
        ytDlpBinaryPath: '',
        ffmpegBinaryPath: '',
      } as never,
      sourceOptions as never,
    );

    expect(
      builder.buildStreamCommand('https://example.com/video', {
        format: 'b[ext=mp4]/b',
        profile: 'default',
        requiresFileOutput: true,
      }).binary,
    ).toBe('yt-dlp');
  });

  it('writes to a file output template when requested', () => {
    const builder = new YtDlpStreamCommandBuilder(
      {
        ytDlpBinaryPath: '/usr/local/bin/yt-dlp',
        ffmpegBinaryPath: '/usr/local/bin/ffmpeg',
      } as never,
      sourceOptions as never,
    );

    const command = builder.buildStreamCommand(
      'https://example.com/video',
      {
        format: 'video+audio',
        profile: 'custom',
        requiresFileOutput: true,
      },
      {
        kind: 'file',
        outputTemplate: '/tmp/download.%(ext)s',
      },
    );

    expect(command.args).toEqual(
      expect.arrayContaining(['-o', '/tmp/download.%(ext)s']),
    );
  });

  it('includes source-specific yt-dlp args', () => {
    const builder = new YtDlpStreamCommandBuilder(
      {
        ytDlpBinaryPath: '/usr/local/bin/yt-dlp',
        ffmpegBinaryPath: '',
      } as never,
      sourceOptions as never,
    );
    sourceOptions.getDownloadArgs.mockReturnValue([
      '--sleep-requests',
      '1.5',
      '--retry-sleep',
      'extractor:exp=30:300',
    ]);

    const command = builder.buildStreamCommand('https://instagram.com/reel/a', {
      format: '18',
      profile: 'custom',
      requiresFileOutput: false,
    });

    expect(command.args).toEqual(
      expect.arrayContaining([
        '--sleep-requests',
        '1.5',
        '--retry-sleep',
        'extractor:exp=30:300',
      ]),
    );
  });
});
