import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { HarvestAreaEntity } from './harvest-area.entity';
import { WeighingStationEntity } from './weighing-station.entity';
import { TripStatusEnum } from '../../../../domain/trip-status.enum';
import { ReceiptEntity } from './receipt.entity';

@Entity({
  name: 'trips',
})
export class TripEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'driver_id' })
  driver: UserEntity;

  @ManyToOne(() => HarvestAreaEntity, { nullable: false })
  @JoinColumn({ name: 'harvest_area_id' })
  harvestArea: HarvestAreaEntity;

  @ManyToOne(() => WeighingStationEntity, { nullable: false })
  @JoinColumn({ name: 'weighing_station_id' })
  weighingStation: WeighingStationEntity;

  @Column({
    name: 'start_time',
    type: 'timestamptz',
    nullable: true,
  })
  startTime: Date | null;

  @Column({
    name: 'end_time',
    type: 'timestamptz',
    nullable: true,
  })
  endTime: Date | null;

  @Column({
    name: 'estimated_distance',
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  estimatedDistance: string | null;

  @Column({
    name: 'total_tons',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalTons: string;

  @Column({
    name: 'total_receipts',
    type: 'int',
    default: 0,
  })
  totalReceipts: number;

  @Column({
    type: String,
    length: 20,
    default: TripStatusEnum.planned,
  })
  status: TripStatusEnum;

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

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
  })
  deletedAt: Date | null;

  @OneToMany(() => ReceiptEntity, (r) => r.trip)
  receipts: ReceiptEntity[];
}
