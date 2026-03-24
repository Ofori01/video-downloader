import { IsNotEmpty, IsUrl } from 'class-validator';

export class CreateVideoJobDto {
  @IsUrl({ require_protocol: true })
  @IsNotEmpty()
  url!: string;
}
