import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { HarvestAreaEntity } from './harvest-area.entity';

@Entity({
  name: 'driver_harvest_areas',
})
export class DriverHarvestAreaEntity extends EntityRelationalHelper {
  @PrimaryColumn({
    name: 'driver_id',
    type: 'int',
  })
  driverId: number;

  @PrimaryColumn({
    name: 'harvest_area_id',
    type: 'uuid',
  })
  harvestAreaId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: UserEntity;

  @ManyToOne(() => HarvestAreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'harvest_area_id' })
  harvestArea: HarvestAreaEntity;
}
