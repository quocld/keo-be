import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationReferenceId1763500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "reference_id" character varying(100)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "reference_id"`,
    );
  }
}
