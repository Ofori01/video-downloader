import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { VideoController } from '../src/modules/video/video.controller';
import { VideoService } from '../src/modules/video/video.service';
import { SessionMiddleware } from '../src/modules/session/session.middleware';
import { AppConfigService } from '../src/config/app-config.service';
import { SessionService } from '../src/modules/session/session.service';

const videoServiceMock = {
  submitDownload: jest.fn(),
  getFileStatus: jest.fn(),
  getDownloadUrl: jest.fn(),
};

@Module({
  controllers: [VideoController],
  providers: [
    {
      provide: VideoService,
      useValue: videoServiceMock,
    },
    {
      provide: AppConfigService,
      useValue: {
        sessionCookieName: 'sessionId',
        sessionCookieSecure: false,
        sessionCookieMaxAgeSeconds: 86400,
      },
    },
    {
      provide: SessionService,
      useValue: {
        touchSession: jest.fn().mockResolvedValue(undefined),
      },
    },
    SessionMiddleware,
  ],
})
class VideoJobsTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}

describe('Video jobs endpoint (integration)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [VideoJobsTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a new session cookie and submits job', async () => {
    videoServiceMock.submitDownload.mockResolvedValue({
      fileId: 'file-1',
      jobId: 'job-1',
      estimatedSize: 12345,
      status: 'processing',
    });

    const response = await request(app.getHttpServer())
      .post('/video/jobs')
      .send({ url: 'https://example.com/video' })
      .expect(201);

    expect(response.body).toEqual({
      fileId: 'file-1',
      jobId: 'job-1',
      estimatedSize: 12345,
      status: 'processing',
    });

    expect(response.headers['set-cookie']).toBeDefined();
    expect(videoServiceMock.submitDownload).toHaveBeenCalledTimes(1);
    expect(videoServiceMock.submitDownload.mock.calls[0][0]).toBe(
      'https://example.com/video',
    );
    expect(typeof videoServiceMock.submitDownload.mock.calls[0][1]).toBe(
      'string',
    );
    expect(videoServiceMock.submitDownload.mock.calls[0][1]).not.toHaveLength(
      0,
    );
  });

  it('reuses existing session cookie across requests', async () => {
    videoServiceMock.submitDownload.mockResolvedValue({
      fileId: 'file-2',
      jobId: 'job-2',
      estimatedSize: 200,
      status: 'processing',
    });

    const firstResponse = await request(app.getHttpServer())
      .post('/video/jobs')
      .send({ url: 'https://example.com/video' })
      .expect(201);

    const cookie = firstResponse.headers['set-cookie'][0];

    await request(app.getHttpServer())
      .post('/video/jobs')
      .set('Cookie', cookie)
      .send({ url: 'https://example.com/video-2' })
      .expect(201);

    expect(videoServiceMock.submitDownload).toHaveBeenCalledTimes(2);
    const firstSessionId = videoServiceMock.submitDownload.mock.calls[0][1];
    const secondSessionId = videoServiceMock.submitDownload.mock.calls[1][1];
    expect(firstSessionId).toBe(secondSessionId);
  });
});
