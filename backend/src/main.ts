import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { AppConfigService } from './config/app-config.service';
import { createCorsOptions } from './config/cors-options';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  const config = app.get(AppConfigService);
  app.enableCors(createCorsOptions(config.frontendOrigin));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
