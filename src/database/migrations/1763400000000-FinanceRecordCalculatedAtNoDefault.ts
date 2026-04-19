import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceRecordCalculatedAtNoDefault1763400000000 implements MigrationInterface {
  name = 'FinanceRecordCalculatedAtNoDefault1763400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove the DEFAULT NOW() — calculated_at is now always set explicitly
    // to the receipt's receipt_date so analytics group by the correct business date.
    await queryRunner.query(
      `ALTER TABLE "finance_records" ALTER COLUMN "calculated_at" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "finance_records" ALTER COLUMN "calculated_at" SET DEFAULT now()`,
    );
  }
}
