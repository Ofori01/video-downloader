import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FileEntity } from './file.entity';

@Entity({ name: 'sessions' })
export class SessionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  lastSeenAt!: Date;

  @Column({ type: 'integer', default: 0 })
  requestCount!: number;

  @OneToMany(() => FileEntity, (file) => file.session)
  files!: FileEntity[];
}
