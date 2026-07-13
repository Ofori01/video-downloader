import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import request from 'supertest';
import { App } from 'supertest/types';
import { VideoController } from '../src/modules/video/video.controller';
import { DownloadFileAccessService } from '../src/modules/video/download-file-access.service';
import { DownloadIntakeService } from '../src/modules/video/download-intake.service';
import { SessionMiddleware } from '../src/modules/session/session.middleware';
import { AppConfigService } from '../src/config/app-config.service';
import { SessionService } from '../src/modules/session/session.service';
import { ProfileCatalogueService } from '../src/modules/video/profile-catalogue.service';

interface DownloadIntakeSubmitCommand {
  url: string;
  sessionId: string;
  profileId?: string;
}

const downloadIntakeMock: {
  submit: jest.Mock<Promise<unknown>, [DownloadIntakeSubmitCommand]>;
} = {
  submit: jest.fn<Promise<unknown>, [DownloadIntakeSubmitCommand]>(),
};

const downloadFileAccessMock = {
  getFileStatus: jest.fn(),
  getDownloadUrl: jest.fn(),
};

const getFirstSetCookie = (headers: IncomingHttpHeaders): string => {
  const setCookie = headers['set-cookie'];
  if (Array.isArray(setCookie)) {
    return setCookie[0] ?? '';
  }

  return setCookie ?? '';
};

@Module({
  controllers: [VideoController],
  providers: [
    {
      provide: DownloadIntakeService,
      useValue: downloadIntakeMock,
    },
    {
      provide: DownloadFileAccessService,
      useValue: downloadFileAccessMock,
    },
    {
      provide: ProfileCatalogueService,
      useValue: {
        getAvailableProfiles: jest.fn(),
      },
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
    downloadIntakeMock.submit.mockResolvedValue({
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

    expect(getFirstSetCookie(response.headers)).not.toHaveLength(0);
    expect(downloadIntakeMock.submit).toHaveBeenCalledTimes(1);
    const submitted = downloadIntakeMock.submit.mock.calls[0][0];
    expect(submitted.url).toBe('https://example.com/video');
    expect(typeof submitted.sessionId).toBe('string');
    expect(submitted.sessionId).not.toHaveLength(0);
  });

  it('reuses existing session cookie across requests', async () => {
    downloadIntakeMock.submit.mockResolvedValue({
      fileId: 'file-2',
      jobId: 'job-2',
      estimatedSize: 200,
      status: 'processing',
    });

    const firstResponse = await request(app.getHttpServer())
      .post('/video/jobs')
      .send({ url: 'https://example.com/video' })
      .expect(201);

    const cookie = getFirstSetCookie(firstResponse.headers);

    await request(app.getHttpServer())
      .post('/video/jobs')
      .set('Cookie', cookie)
      .send({ url: 'https://example.com/video-2' })
      .expect(201);

    expect(downloadIntakeMock.submit).toHaveBeenCalledTimes(2);
    const firstSessionId = downloadIntakeMock.submit.mock.calls[0][0].sessionId;
    const secondSessionId =
      downloadIntakeMock.submit.mock.calls[1][0].sessionId;
    expect(firstSessionId).toBe(secondSessionId);
  });
});
