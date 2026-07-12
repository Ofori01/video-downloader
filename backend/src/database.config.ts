import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { FileEntity } from './entities/file.entity';
import { SessionEntity } from './entities/session.entity';

// Load environment variables
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [FileEntity, SessionEntity],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  migrationsRun: false,
  logging: process.env.NODE_ENV === 'development',
  synchronize: false,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});
