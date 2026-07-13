import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileProfileId1783851658953 implements MigrationInterface {
  name = 'AddFileProfileId1783851658953';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "files" ADD "profileId" character varying(128)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "files" DROP COLUMN "profileId"');
  }
}
