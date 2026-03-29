import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { DriverProfileEntity } from '../../infrastructure/persistence/relational/entities/driver-profile.entity';
import { VehicleEntity } from '../../infrastructure/persistence/relational/entities/vehicle.entity';
import { OpsAuthorizationService } from './ops-authorization.service';
import { normalizeVehiclePlate } from './vehicles.service';

@Injectable()
export class OwnerDriverVehicleService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehiclesRepository: Repository<VehicleEntity>,
    @InjectRepository(DriverProfileEntity)
    private readonly driverProfilesRepository: Repository<DriverProfileEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
  ) {}

  async get(
    ownerActor: JwtPayloadType,
    driverId: number,
  ): Promise<VehicleEntity | null> {
    await this.opsAuthorizationService.assertOwnerManagesDriver(
      ownerActor,
      driverId,
    );

    const ownerId = Number(ownerActor.id);

    return this.vehiclesRepository.findOne({
      where: {
        assignedDriver: { id: driverId },
        owner: { id: ownerId },
      },
      relations: ['owner', 'assignedDriver'],
    });
  }

  async set(
    ownerActor: JwtPayloadType,
    driverId: number,
    vehicleId: string | null | undefined,
  ): Promise<void> {
    if (vehicleId === undefined) {
      throw new UnprocessableEntityException({ error: 'vehicleIdRequired' });
    }

    await this.opsAuthorizationService.assertOwnerManagesDriver(
      ownerActor,
      driverId,
    );

    const ownerId = Number(ownerActor.id);

    await this.vehiclesRepository.manager.transaction(async (em) => {
      const vRepo = em.getRepository(VehicleEntity);
      const dpRepo = em.getRepository(DriverProfileEntity);

      await vRepo
        .createQueryBuilder()
        .update(VehicleEntity)
        .set({ assignedDriver: null })
        .where('assigned_driver_id = :driverId', { driverId })
        .execute();

      if (vehicleId === null || vehicleId === '') {
        await dpRepo.update(
          { userId: driverId },
          { vehiclePlate: null, updatedAt: new Date() },
        );
        return;
      }

      const vehicle = await vRepo.findOne({
        where: {
          id: vehicleId,
          owner: { id: ownerId },
        },
      });

      if (!vehicle) {
        throw new UnprocessableEntityException({
          error: 'invalidVehicleId',
        });
      }

      await vRepo.update(
        { id: vehicle.id },
        { assignedDriver: { id: driverId } as any },
      );

      await dpRepo.update(
        { userId: driverId },
        {
          vehiclePlate: normalizeVehiclePlate(vehicle.plate),
          updatedAt: new Date(),
        },
      );
    });
  }
}
