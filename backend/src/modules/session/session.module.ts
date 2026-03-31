import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { SessionEntity } from '../../entities/session.entity';
import { QueueModule } from '../queue/queue.module';
import { SessionService } from './session.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionEntity]),
    AppConfigModule,
    QueueModule,
  ],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
