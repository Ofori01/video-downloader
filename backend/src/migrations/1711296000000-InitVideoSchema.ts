import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitVideoSchema1711296000000 implements MigrationInterface {
  name = 'InitVideoSchema1711296000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(
      `CREATE TYPE "public"."files_status_enum" AS ENUM('queued', 'processing', 'ready', 'failed', 'deleted')`,
    );

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "requestCount" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(512) NOT NULL,
        "sourceUrl" text NOT NULL,
        "size" bigint,
        "status" "public"."files_status_enum" NOT NULL DEFAULT 'processing',
        "sessionId" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "downloadedAt" TIMESTAMP WITH TIME ZONE,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "queueJobId" character varying(128),
        "errorReason" text,
        CONSTRAINT "UQ_106af0fda6f05f7780fa30f9974" UNIQUE ("key"),
        CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"),
        CONSTRAINT "FK_4d7a842bfd70f9503db6ec467a2" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "idx_files_status" ON "files" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_files_session_id" ON "files" ("sessionId")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_files_expires_at" ON "files" ("expiresAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_files_created_at" ON "files" ("createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."idx_files_created_at"');
    await queryRunner.query('DROP INDEX "public"."idx_files_expires_at"');
    await queryRunner.query('DROP INDEX "public"."idx_files_session_id"');
    await queryRunner.query('DROP INDEX "public"."idx_files_status"');
    await queryRunner.query(
      'ALTER TABLE "files" DROP CONSTRAINT "FK_4d7a842bfd70f9503db6ec467a2"',
    );
    await queryRunner.query('DROP TABLE "files"');
    await queryRunner.query('DROP TABLE "sessions"');
    await queryRunner.query('DROP TYPE "public"."files_status_enum"');
  }
}
