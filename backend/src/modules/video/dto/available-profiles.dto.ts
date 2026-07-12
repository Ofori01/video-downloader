export class AvailableProfileDto {
  id!: string;

  label!: string;

  format!: string;

  ext!: string;

  contentType!: string;

  mediaKind!: 'audio' | 'video';

  resolution?: string;

  codec?: string;

  audioCodec?: string;

  estimatedSize?: number;

  hasAudio!: boolean;

  hasVideo!: boolean;

  isAudioOnly!: boolean;
}
