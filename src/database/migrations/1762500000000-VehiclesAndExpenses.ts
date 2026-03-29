import { MigrationInterface, QueryRunner } from 'typeorm';

export class VehiclesAndExpenses1762500000000 implements MigrationInterface {
  name = 'VehiclesAndExpenses1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plate" character varying(20) NOT NULL, "name" character varying(150), "status" character varying(20) NOT NULL DEFAULT 'active', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "owner_id" integer NOT NULL, "assigned_driver_id" integer, CONSTRAINT "UQ_vehicles_plate" UNIQUE ("plate"), CONSTRAINT "UQ_vehicles_assigned_driver_id" UNIQUE ("assigned_driver_id"), CONSTRAINT "PK_vehicles_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vehicles_owner_id" ON "vehicles" ("owner_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "FK_vehicles_owner_id" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "FK_vehicles_assigned_driver_id" FOREIGN KEY ("assigned_driver_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "vehicle_expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expense_type" character varying(20) NOT NULL, "amount" numeric(15,2) NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "vehicle_id" uuid NOT NULL, "created_by_user_id" integer, CONSTRAINT "PK_vehicle_expenses_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vehicle_expenses_vehicle_occurred" ON "vehicle_expenses" ("vehicle_id", "occurred_at" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicle_expenses" ADD CONSTRAINT "FK_vehicle_expenses_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicle_expenses" ADD CONSTRAINT "FK_vehicle_expenses_created_by_user_id" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vehicle_expenses" DROP CONSTRAINT "FK_vehicle_expenses_created_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicle_expenses" DROP CONSTRAINT "FK_vehicle_expenses_vehicle_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_vehicle_expenses_vehicle_occurred"`,
    );
    await queryRunner.query(`DROP TABLE "vehicle_expenses"`);

    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "FK_vehicles_assigned_driver_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "FK_vehicles_owner_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_vehicles_owner_id"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
  }
}
