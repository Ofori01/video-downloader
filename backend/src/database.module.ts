import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { FileEntity } from './entities/file.entity';
import { SessionEntity } from './entities/session.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: 'postgres' as const,
        url: config.databaseUrl,
        entities: [FileEntity, SessionEntity],
        migrations: ['dist/migrations/*.js'],
        migrationsRun: false,
        synchronize: false,
        logging: config.nodeEnv === 'development',
        ssl: config.databaseUrl.includes('localhost')
          ? false
          : { rejectUnauthorized: false },
      }),
    }),
  ],
})
export class DatabaseModule {}
