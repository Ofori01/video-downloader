import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileUpdatedAt1783851658954 implements MigrationInterface {
  name = 'AddFileUpdatedAt1783851658954';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "files" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_files_updated_at" ON "files" ("updatedAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."idx_files_updated_at"');
    await queryRunner.query('ALTER TABLE "files" DROP COLUMN "updatedAt"');
  }
}
