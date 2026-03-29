import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { DriverProfileEntity } from '../../infrastructure/persistence/relational/entities/driver-profile.entity';
import { VehicleEntity } from '../../infrastructure/persistence/relational/entities/vehicle.entity';
import { CreateVehicleDto } from '../../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../../dto/update-vehicle.dto';
import { QueryVehicleDto } from '../../dto/query-vehicle.dto';
import { OpsAuthorizationService } from './ops-authorization.service';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';

export function normalizeVehiclePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehiclesRepository: Repository<VehicleEntity>,
    @InjectRepository(DriverProfileEntity)
    private readonly driverProfilesRepository: Repository<DriverProfileEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
  ) {}

  async create(
    actor: JwtPayloadType,
    dto: CreateVehicleDto,
  ): Promise<VehicleEntity> {
    let ownerId: number;

    if (this.opsAuthorizationService.isOwner(actor)) {
      ownerId = Number(actor.id);
      if (dto.ownerId != null && dto.ownerId !== ownerId) {
        throw new ForbiddenException({ error: 'forbidden' });
      }
    } else if (this.opsAuthorizationService.isAdmin(actor)) {
      if (dto.ownerId == null) {
        throw new UnprocessableEntityException({ error: 'ownerIdRequired' });
      }
      ownerId = dto.ownerId;
    } else {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const plate = normalizeVehiclePlate(dto.plate);
    const dup = await this.vehiclesRepository.findOne({
      where: { plate },
    });
    if (dup) {
      throw new UnprocessableEntityException({ error: 'duplicatePlate' });
    }

    const entity = this.vehiclesRepository.create({
      plate,
      name: dto.name ?? null,
      notes: dto.notes ?? null,
      status: dto.status ?? 'active',
      owner: { id: ownerId } as any,
    });

    return this.vehiclesRepository.save(entity);
  }

  async findMany(
    actor: JwtPayloadType,
    query: QueryVehicleDto,
  ): Promise<InfinityPaginationResponseDto<VehicleEntity>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<VehicleEntity> = {};

    if (query.filters?.status) {
      where.status = query.filters.status;
    }

    if (this.opsAuthorizationService.isDriver(actor)) {
      where.assignedDriver = { id: Number(actor.id) };
    } else if (this.opsAuthorizationService.isOwner(actor)) {
      where.owner = { id: Number(actor.id) };
    } else if (this.opsAuthorizationService.isAdmin(actor)) {
      if (query.filters?.ownerId != null) {
        where.owner = { id: query.filters.ownerId };
      }
    } else {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const data = await this.vehiclesRepository.find({
      where,
      relations: ['owner', 'assignedDriver'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return infinityPagination(data, { page, limit });
  }

  async findOne(actor: JwtPayloadType, id: string): Promise<VehicleEntity> {
    const entity = await this.vehiclesRepository.findOne({
      where: { id },
      relations: ['owner', 'assignedDriver'],
    });

    if (!entity) {
      throw new NotFoundException({ error: 'vehicle not found' });
    }

    if (this.opsAuthorizationService.isDriver(actor)) {
      if (entity.assignedDriver?.id !== Number(actor.id)) {
        throw new NotFoundException({ error: 'vehicle not found' });
      }
      return entity;
    }

    if (this.opsAuthorizationService.isOwner(actor)) {
      if (entity.owner?.id !== Number(actor.id)) {
        throw new ForbiddenException({ error: 'forbidden' });
      }
    } else if (!this.opsAuthorizationService.isAdmin(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    return entity;
  }

  async update(
    actor: JwtPayloadType,
    id: string,
    dto: UpdateVehicleDto,
  ): Promise<VehicleEntity> {
    await this.opsAuthorizationService.assertAdminOrOwnsVehicle(actor, id);

    const entity = await this.vehiclesRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException({ error: 'vehicle not found' });
    }

    if (dto.plate !== undefined) {
      const plate = normalizeVehiclePlate(dto.plate);
      const dup = await this.vehiclesRepository.findOne({
        where: { plate },
      });
      if (dup && dup.id !== id) {
        throw new UnprocessableEntityException({ error: 'duplicatePlate' });
      }
      entity.plate = plate;
    }

    if (dto.name !== undefined) entity.name = dto.name ?? null;
    if (dto.notes !== undefined) entity.notes = dto.notes ?? null;
    if (dto.status !== undefined) entity.status = dto.status ?? entity.status;

    if (dto.ownerId !== undefined) {
      if (!this.opsAuthorizationService.isAdmin(actor)) {
        throw new ForbiddenException({ error: 'forbidden' });
      }
      entity.owner = { id: dto.ownerId } as any;
    }

    return this.vehiclesRepository.save(entity);
  }

  async softDelete(actor: JwtPayloadType, id: string): Promise<void> {
    await this.opsAuthorizationService.assertAdminOrOwnsVehicle(actor, id);

    const entity = await this.vehiclesRepository.findOne({
      where: { id },
      relations: ['assignedDriver'],
    });

    if (!entity) {
      throw new NotFoundException({ error: 'vehicle not found' });
    }

    const driverId = entity.assignedDriver?.id;
    if (driverId != null) {
      await this.driverProfilesRepository.update(
        { userId: driverId },
        { vehiclePlate: null, updatedAt: new Date() },
      );
    }

    await this.vehiclesRepository.update({ id }, { assignedDriver: null });
    await this.vehiclesRepository.softDelete(id);
  }
}
