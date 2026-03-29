import {
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { RoleEnum } from '../../../roles/roles.enum';
import { UserEntity } from '../../../users/infrastructure/persistence/relational/entities/user.entity';
import { DriverHarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/driver-harvest-area.entity';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { WeighingStationEntity } from '../../infrastructure/persistence/relational/entities/weighing-station.entity';
import { VehicleEntity } from '../../infrastructure/persistence/relational/entities/vehicle.entity';

@Injectable()
export class OpsAuthorizationService {
  constructor(
    @InjectRepository(HarvestAreaEntity)
    private readonly harvestAreasRepository: Repository<HarvestAreaEntity>,
    @InjectRepository(WeighingStationEntity)
    private readonly weighingStationsRepository: Repository<WeighingStationEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(DriverHarvestAreaEntity)
    private readonly driverHarvestAreasRepository: Repository<DriverHarvestAreaEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehiclesRepository: Repository<VehicleEntity>,
  ) {}

  isAdmin(actor: JwtPayloadType): boolean {
    return actor?.role?.id?.toString() === RoleEnum.admin.toString();
  }

  isOwner(actor: JwtPayloadType): boolean {
    return actor?.role?.id?.toString() === RoleEnum.owner.toString();
  }

  isDriver(actor: JwtPayloadType): boolean {
    return actor?.role?.id?.toString() === RoleEnum.driver.toString();
  }

  assertAdmin(actor: JwtPayloadType): void {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  assertAdminOrOwner(actor: JwtPayloadType): void {
    if (!this.isAdmin(actor) && !this.isOwner(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  assertDriver(actor: JwtPayloadType): void {
    if (!this.isDriver(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  async assertOwnerOwnsHarvestArea(
    actor: JwtPayloadType,
    harvestAreaId: string,
  ): Promise<void> {
    if (!this.isOwner(actor)) {
      this.assertAdmin(actor);
      return;
    }

    const ownedHarvestArea = await this.harvestAreasRepository.findOne({
      where: {
        id: harvestAreaId,
        owner: {
          id: Number(actor.id),
        },
      },
    });

    if (!ownedHarvestArea) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  async assertAdminOrOwnsWeighingStation(
    actor: JwtPayloadType,
    weighingStationId: string,
  ): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }

    if (!this.isOwner(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const owned = await this.weighingStationsRepository.findOne({
      where: {
        id: weighingStationId,
        owner: { id: Number(actor.id) },
      },
    });

    if (!owned) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  async assertAdminOrOwnsVehicle(
    actor: JwtPayloadType,
    vehicleId: string,
  ): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }

    if (!this.isOwner(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const owned = await this.vehiclesRepository.findOne({
      where: {
        id: vehicleId,
        owner: { id: Number(actor.id) },
      },
    });

    if (!owned) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  async getManagedOwnerIdForDriver(
    actor: JwtPayloadType,
  ): Promise<number | null> {
    if (!this.isDriver(actor)) {
      return null;
    }

    const user = await this.usersRepository.findOne({
      where: { id: Number(actor.id) },
      relations: ['managedByOwner'],
    });

    if (!user?.managedByOwner?.id) {
      return null;
    }

    return Number(user.managedByOwner.id);
  }

  async assertOwnerManagesDriver(
    ownerActor: JwtPayloadType,
    driverId: number,
  ): Promise<void> {
    if (!this.isOwner(ownerActor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const driver = await this.usersRepository.findOne({
      where: { id: driverId },
      relations: ['managedByOwner', 'role'],
    });

    if (!driver) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    if (driver.role?.id?.toString() !== RoleEnum.driver.toString()) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    if (Number(driver.managedByOwner?.id) !== Number(ownerActor.id)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  async assertDriverAssignedToHarvestArea(
    actor: JwtPayloadType,
    harvestAreaId: string,
  ): Promise<void> {
    this.assertDriver(actor);

    const managedOwnerId = await this.getManagedOwnerIdForDriver(actor);
    if (managedOwnerId == null) {
      throw new UnprocessableEntityException({
        error: 'driverHasNoManagingOwner',
      });
    }

    const assigned = await this.driverHarvestAreasRepository.findOne({
      where: {
        driverId: Number(actor.id),
        harvestAreaId,
      },
    });

    if (!assigned) {
      throw new UnprocessableEntityException({
        error: 'driverNotAssignedToHarvestArea',
      });
    }

    const harvestArea = await this.harvestAreasRepository.findOne({
      where: { id: harvestAreaId },
      relations: ['owner'],
    });

    if (!harvestArea || harvestArea.owner?.id !== managedOwnerId) {
      throw new UnprocessableEntityException({
        error: 'harvestAreaNotAllowedForDriver',
      });
    }
  }

  async assertDriverMayUseWeighingStation(
    actor: JwtPayloadType,
    weighingStationId: string,
  ): Promise<void> {
    this.assertDriver(actor);

    const managedOwnerId = await this.getManagedOwnerIdForDriver(actor);
    if (managedOwnerId == null) {
      throw new UnprocessableEntityException({
        error: 'driverHasNoManagingOwner',
      });
    }

    const station = await this.weighingStationsRepository.findOne({
      where: { id: weighingStationId },
      relations: ['owner'],
    });

    if (!station) {
      throw new UnprocessableEntityException({
        error: 'weighingStationNotFound',
      });
    }

    if (station.owner?.id == null) {
      throw new UnprocessableEntityException({
        error: 'weighingStationNotAllowedForDriver',
      });
    }

    if (Number(station.owner.id) !== managedOwnerId) {
      throw new UnprocessableEntityException({
        error: 'weighingStationNotAllowedForDriver',
      });
    }
  }

  /**
   * Validates harvest assignment and owner alignment; optionally weighing station (required when id passed).
   */
  async assertDriverHarvestAndWeighingForOps(
    actor: JwtPayloadType,
    harvestAreaId: string,
    weighingStationId: string | null,
  ): Promise<void> {
    await this.assertDriverAssignedToHarvestArea(actor, harvestAreaId);

    if (weighingStationId) {
      await this.assertDriverMayUseWeighingStation(actor, weighingStationId);
    }
  }
}
