import { MigrationInterface, QueryRunner } from 'typeorm';

export class DriverHarvestArea1762400000000 implements MigrationInterface {
  name = 'DriverHarvestArea1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "driver_harvest_areas" ("driver_id" integer NOT NULL, "harvest_area_id" uuid NOT NULL, CONSTRAINT "PK_driver_harvest_areas" PRIMARY KEY ("driver_id", "harvest_area_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_driver_harvest_areas_harvest_area_id" ON "driver_harvest_areas" ("harvest_area_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_harvest_areas" ADD CONSTRAINT "FK_driver_harvest_areas_driver" FOREIGN KEY ("driver_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_harvest_areas" ADD CONSTRAINT "FK_driver_harvest_areas_harvest_area" FOREIGN KEY ("harvest_area_id") REFERENCES "harvest_areas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "driver_harvest_areas" DROP CONSTRAINT "FK_driver_harvest_areas_harvest_area"`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_harvest_areas" DROP CONSTRAINT "FK_driver_harvest_areas_driver"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_driver_harvest_areas_harvest_area_id"`,
    );
    await queryRunner.query(`DROP TABLE "driver_harvest_areas"`);
  }
}
