import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity({
  name: 'vehicles',
})
export class VehicleEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: UserEntity;

  @Column({
    type: String,
    length: 20,
    unique: true,
  })
  plate: string;

  @Column({
    type: String,
    length: 150,
    nullable: true,
  })
  name: string | null;

  @Column({
    type: String,
    length: 20,
    default: 'active',
  })
  status: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes: string | null;

  @ManyToOne(() => UserEntity, {
    nullable: true,
  })
  @JoinColumn({ name: 'assigned_driver_id' })
  assignedDriver: UserEntity | null;

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
}
