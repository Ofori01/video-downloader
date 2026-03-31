export class AvailableProfileDto {
  id!: string;

  label!: string;

  format!: string;

  resolution?: string;

  codec?: string;

  audioCodec?: string;

  estimatedSize?: number;

  isAudioOnly!: boolean;
}
