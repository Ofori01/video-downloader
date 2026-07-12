import type { AvailableProfile } from "@/types";
import {
  ensureSessionId,
  ensureValidUrl,
  getActualFormatSize,
  getMetadata,
  touchSession,
} from "@/lib/server/video-jobs";

type RawFormat = {
  format_id?: string;
  height?: number;
  ext?: string;
  vcodec?: string;
  acodec?: string;
  abr?: number;
  tbr?: number;
  filesize?: number;
  filesize_approx?: number;
};

function cleanCodec(codec: string): string {
  const map: Record<string, string> = {
    h264: "H.264",
    h265: "H.265",
    vp9: "VP9",
    av1: "AV1",
    opus: "Opus",
    aac: "AAC",
    mp3: "MP3",
    vorbis: "Vorbis",
  };

  const lower = codec.toLowerCase();
  return map[lower] || codec.toUpperCase();
}

function formatLabel(format: RawFormat): string {
  const parts: string[] = [];

  if (format.height) {
    parts.push(`${format.height}p`);
  }

  if (format.vcodec && format.vcodec !== "none") {
    parts.push(cleanCodec(format.vcodec));
  }

  if (format.acodec && format.acodec !== "none") {
    parts.push(cleanCodec(format.acodec));
  }

  if (format.ext) {
    parts.push(format.ext.toUpperCase());
  }

  return parts.length > 0 ? parts.join(" · ") : "Default";
}

export async function getAvailableProfilesForUrl(
  sourceUrl: string,
): Promise<AvailableProfile[]> {
  const normalized = ensureValidUrl(sourceUrl);
  const sessionId = await ensureSessionId();
  await touchSession(sessionId);

  const metadata = (await getMetadata(normalized)) as {
    format_id?: string;
    formats?: RawFormat[];
  };

  if (!Array.isArray(metadata.formats) || metadata.formats.length === 0) {
    return [];
  }

  const profiles: AvailableProfile[] = [];
  const seen = new Set<string>();

  const best = metadata.formats.find(
    (format) => format.format_id === metadata.format_id,
  );

  if (best?.format_id && !seen.has(best.format_id)) {
    seen.add(best.format_id);
    const size = getActualFormatSize(best, metadata);

    profiles.push({
      id: best.format_id,
      label: formatLabel(best),
      format: best.format_id,
      resolution: best.height ? `${best.height}p` : undefined,
      codec:
        best.vcodec && best.vcodec !== "none"
          ? cleanCodec(best.vcodec)
          : undefined,
      audioCodec:
        best.acodec && best.acodec !== "none"
          ? cleanCodec(best.acodec)
          : undefined,
      estimatedSize: size,
      isAudioOnly: false,
    });
  }

  for (const height of [720, 480, 360]) {
    const candidates = metadata.formats.filter(
      (format) =>
        format.vcodec &&
        format.vcodec !== "none" &&
        format.height === height &&
        format.ext === "mp4",
    );

    if (candidates.length === 0) {
      continue;
    }

    const tier = candidates.sort((a, b) => {
      const aHasAudio = a.acodec && a.acodec !== "none" ? 1 : 0;
      const bHasAudio = b.acodec && b.acodec !== "none" ? 1 : 0;
      if (aHasAudio !== bHasAudio) {
        return bHasAudio - aHasAudio;
      }

      const aBitrate = a.abr || a.tbr || 0;
      const bBitrate = b.abr || b.tbr || 0;
      if (aBitrate !== bBitrate) {
        return bBitrate - aBitrate;
      }

      return (b.filesize || 0) - (a.filesize || 0);
    })[0];

    const key = `video_${height}p`;
    if (!tier?.format_id || seen.has(key)) {
      continue;
    }

    seen.add(key);
    const hasAudio = tier.acodec && tier.acodec !== "none";

    profiles.push({
      id: tier.format_id,
      label: hasAudio ? `${height}p with audio` : `${height}p video only`,
      format: tier.format_id,
      resolution: `${height}p`,
      codec: tier.vcodec ? cleanCodec(tier.vcodec) : undefined,
      audioCodec: hasAudio ? cleanCodec(tier.acodec as string) : undefined,
      estimatedSize: getActualFormatSize(tier, metadata),
      isAudioOnly: false,
    });
  }

  const audioOnlyCandidates = metadata.formats.filter(
    (format) =>
      (!format.vcodec || format.vcodec === "none") &&
      format.acodec &&
      format.acodec !== "none",
  );

  if (audioOnlyCandidates.length > 0 && !seen.has("audio_only")) {
    const audioOnly = audioOnlyCandidates.sort(
      (a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0),
    )[0];

    if (audioOnly?.format_id) {
      seen.add("audio_only");
      profiles.push({
        id: audioOnly.format_id,
        label: `Audio only (${audioOnly.ext || "m4a"})`,
        format: audioOnly.format_id,
        resolution: undefined,
        codec: undefined,
        audioCodec: audioOnly.acodec ? cleanCodec(audioOnly.acodec) : undefined,
        estimatedSize: getActualFormatSize(audioOnly, metadata),
        isAudioOnly: true,
      });
    }
  }

  return profiles;
}
