import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return service status', () => {
      const status = appController.getRootStatus();
      expect(status.service).toBe('video-downloader-api');
      expect(status.status).toBe('ok');
      expect(typeof status.timestamp).toBe('string');
    });
  });
});
