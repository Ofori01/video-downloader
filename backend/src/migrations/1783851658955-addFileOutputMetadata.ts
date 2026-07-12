import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileOutputMetadata1783851658955
  implements MigrationInterface
{
  name = 'AddFileOutputMetadata1783851658955';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "files" ADD "mediaKind" character varying(16)',
    );
    await queryRunner.query(
      'ALTER TABLE "files" ADD "outputExtension" character varying(16)',
    );
    await queryRunner.query(
      'ALTER TABLE "files" ADD "contentType" character varying(128)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "files" DROP COLUMN "contentType"');
    await queryRunner.query(
      'ALTER TABLE "files" DROP COLUMN "outputExtension"',
    );
    await queryRunner.query('ALTER TABLE "files" DROP COLUMN "mediaKind"');
  }
}
