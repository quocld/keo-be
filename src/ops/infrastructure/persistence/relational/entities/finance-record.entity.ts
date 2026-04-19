import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ReceiptEntity } from './receipt.entity';

@Entity({
  name: 'finance_records',
})
export class FinanceRecordEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => ReceiptEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'receipt_id',
  })
  receipt: ReceiptEntity;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  revenue: string;

  @Column({
    name: 'cost_driver',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  costDriver: string;

  @Column({
    name: 'cost_harvest',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  costHarvest: string;

  @Column({
    name: 'other_cost',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  otherCost: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    generatedType: 'STORED',
    asExpression: '(revenue - cost_driver - cost_harvest - other_cost)',
  })
  profit: string;

  @Column({
    name: 'calculated_at',
    type: 'timestamptz',
  })
  calculatedAt: Date;
}
