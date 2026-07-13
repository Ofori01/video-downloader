import { YtDlpFormat } from './ytdlp.types';

const AUDIO_EXTENSIONS = ['m4a', 'mp3', 'mp4', 'opus', 'webm'];

export function formatHasVideo(format: YtDlpFormat): boolean {
  return Boolean(
    (format.vcodec && format.vcodec !== 'none') ||
    isLikelyMuxedDirectMp4(format),
  );
}

export function formatHasAudio(format: YtDlpFormat): boolean {
  if (format.acodec && format.acodec !== 'none') {
    return true;
  }

  if (format.acodec === 'none') {
    return false;
  }

  return isLikelyMuxedDirectMp4(format) || isLikelyAudioOnly(format);
}

function isLikelyAudioOnly(format: YtDlpFormat): boolean {
  return (
    !formatHasVideo(format) &&
    Boolean((format.abr ?? format.tbr ?? 0) > 0) &&
    AUDIO_EXTENSIONS.includes(format.ext ?? '')
  );
}

function isLikelyMuxedDirectMp4(format: YtDlpFormat): boolean {
  const protocol = format.protocol?.toLowerCase();
  return (
    format.ext === 'mp4' &&
    Boolean(format.height) &&
    format.hasUrl === true &&
    (protocol === 'http' || protocol === 'https')
  );
}
