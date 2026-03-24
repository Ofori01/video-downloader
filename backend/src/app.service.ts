import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRootStatus(): { service: string; status: string; timestamp: string } {
    return {
      service: 'video-downloader-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
