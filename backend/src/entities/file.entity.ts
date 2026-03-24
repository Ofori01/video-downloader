import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SessionEntity } from './session.entity';

export enum FileStatus {
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  DELETED = 'deleted',
}

@Entity({ name: 'files' })
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 512, unique: true })
  key!: string;

  @Column({ type: 'text' })
  sourceUrl!: string;

  @Column({ type: 'bigint', nullable: true })
  size!: string | null;

  @Index('idx_files_status')
  @Column({
    type: 'enum',
    enum: FileStatus,
    default: FileStatus.PROCESSING,
  })
  status!: FileStatus;

  @Index('idx_files_session_id')
  @Column({ type: 'varchar', length: 64 })
  sessionId!: string;

  @ManyToOne(() => SessionEntity, (session) => session.files, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'sessionId' })
  session!: SessionEntity;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  downloadedAt!: Date | null;

  @Index('idx_files_expires_at')
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  queueJobId!: string | null;

  @Column({ type: 'text', nullable: true })
  errorReason!: string | null;
}
