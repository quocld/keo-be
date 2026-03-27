import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripPlannedStatus1761000000000 implements MigrationInterface {
  name = 'TripPlannedStatus1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "CHK_trips_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "CHK_trips_status" CHECK ("status" IN ('planned','in_progress','completed','cancelled'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ALTER COLUMN "status" SET DEFAULT 'planned'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "trips" SET "status" = 'in_progress' WHERE "status" = 'planned'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "CHK_trips_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "CHK_trips_status" CHECK ("status" IN ('in_progress','completed','cancelled'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ALTER COLUMN "status" SET DEFAULT 'in_progress'`,
    );
  }
}
