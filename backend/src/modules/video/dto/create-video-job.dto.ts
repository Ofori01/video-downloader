import { IsNotEmpty, IsUrl, IsOptional, IsString } from 'class-validator';

export class CreateVideoJobDto {
  @IsUrl({ require_protocol: true })
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  profileId?: string;
}
