import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { VehicleEntity } from './vehicle.entity';
import { VehicleExpenseTypeEnum } from '../../../../domain/vehicle-expense-type.enum';

@Entity({
  name: 'vehicle_expenses',
})
export class VehicleExpenseEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VehicleEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @Column({
    name: 'expense_type',
    type: String,
    length: 20,
  })
  expenseType: VehicleExpenseTypeEnum;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  amount: string;

  @Column({
    name: 'occurred_at',
    type: 'timestamptz',
  })
  occurredAt: Date;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes: string | null;

  @ManyToOne(() => UserEntity, {
    nullable: true,
  })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: UserEntity | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;
}
