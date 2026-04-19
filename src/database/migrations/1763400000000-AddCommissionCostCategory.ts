import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommissionCostCategory1763400000000 implements MigrationInterface {
  name = 'AddCommissionCostCategory1763400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "harvest_area_cost_entries" DROP CONSTRAINT IF EXISTS "CHK_harvest_area_cost_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_area_cost_entries" ADD CONSTRAINT "CHK_harvest_area_cost_category" CHECK ("category" IN ('road','loading','labor','commission','other'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "harvest_area_cost_entries" DROP CONSTRAINT IF EXISTS "CHK_harvest_area_cost_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "harvest_area_cost_entries" ADD CONSTRAINT "CHK_harvest_area_cost_category" CHECK ("category" IN ('road','loading','labor','other'))`,
    );
  }
}
