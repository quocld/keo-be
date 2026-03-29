import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { WeighingStationEntity } from '../../infrastructure/persistence/relational/entities/weighing-station.entity';
import { CreateWeighingStationDto } from '../../dto/create-weighing-station.dto';
import { UpdateWeighingStationDto } from '../../dto/update-weighing-station.dto';
import { QueryWeighingStationDto } from '../../dto/query-weighing-station.dto';
import { OpsAuthorizationService } from './ops-authorization.service';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';

@Injectable()
export class WeighingStationsService {
  constructor(
    @InjectRepository(WeighingStationEntity)
    private readonly weighingStationsRepository: Repository<WeighingStationEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
  ) {}

  async create(
    actor: JwtPayloadType,
    dto: CreateWeighingStationDto,
  ): Promise<WeighingStationEntity> {
    let owner: { id: number } | null;

    if (this.opsAuthorizationService.isOwner(actor)) {
      owner = { id: Number(actor.id) };
    } else if (this.opsAuthorizationService.isAdmin(actor)) {
      owner = null;
    } else {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    if (!dto.latitude || !dto.longitude || !dto.unitPrice) {
      throw new UnprocessableEntityException({ error: 'invalid payload' });
    }

    const entity = this.weighingStationsRepository.create({
      name: dto.name,
      code: dto.code ?? null,
      googlePlaceId: dto.googlePlaceId ?? null,
      latitude: dto.latitude.toString(),
      longitude: dto.longitude.toString(),
      formattedAddress: dto.formattedAddress,
      unitPrice: dto.unitPrice.toString(),
      status: dto.status ?? undefined,
      notes: dto.notes ?? null,
      owner: owner as any,
    });

    return this.weighingStationsRepository.save(entity);
  }

  async findMany(
    actor: JwtPayloadType,
    query: QueryWeighingStationDto,
  ): Promise<InfinityPaginationResponseDto<WeighingStationEntity>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<WeighingStationEntity> = {};

    if (query.filters?.status) {
      where.status = query.filters.status;
    }

    if (query.filters?.code) {
      where.code = query.filters.code;
    }

    if (this.opsAuthorizationService.isDriver(actor)) {
      const managedOwnerId =
        await this.opsAuthorizationService.getManagedOwnerIdForDriver(actor);
      if (managedOwnerId == null) {
        return infinityPagination([], { page, limit });
      }
      where.owner = { id: managedOwnerId };
    } else if (this.opsAuthorizationService.isOwner(actor)) {
      where.owner = { id: Number(actor.id) };
    } else if (this.opsAuthorizationService.isAdmin(actor)) {
      if (query.filters?.ownerId != null) {
        where.owner = { id: query.filters.ownerId };
      }
    } else {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const data = await this.weighingStationsRepository.find({
      where,
      relations: ['owner'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return infinityPagination(data, { page, limit });
  }

  async findOne(
    actor: JwtPayloadType,
    id: string,
  ): Promise<WeighingStationEntity> {
    const entity = await this.weighingStationsRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!entity) {
      throw new NotFoundException({ error: 'weighing station not found' });
    }

    if (this.opsAuthorizationService.isDriver(actor)) {
      const managedOwnerId =
        await this.opsAuthorizationService.getManagedOwnerIdForDriver(actor);
      if (
        managedOwnerId == null ||
        entity.owner?.id == null ||
        Number(entity.owner.id) !== managedOwnerId
      ) {
        throw new NotFoundException({ error: 'weighing station not found' });
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
    dto: UpdateWeighingStationDto,
  ): Promise<WeighingStationEntity> {
    await this.opsAuthorizationService.assertAdminOrOwnsWeighingStation(
      actor,
      id,
    );

    const entity = await this.weighingStationsRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException({ error: 'weighing station not found' });
    }

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.code !== undefined) entity.code = dto.code ?? null;
    if (dto.googlePlaceId !== undefined)
      entity.googlePlaceId = dto.googlePlaceId ?? null;
    if (dto.latitude !== undefined) entity.latitude = dto.latitude.toString();
    if (dto.longitude !== undefined)
      entity.longitude = dto.longitude.toString();
    if (dto.formattedAddress !== undefined)
      entity.formattedAddress = dto.formattedAddress;
    if (dto.unitPrice !== undefined)
      entity.unitPrice = dto.unitPrice.toString();
    if (dto.status !== undefined) entity.status = dto.status ?? entity.status;
    if (dto.notes !== undefined) entity.notes = dto.notes ?? null;

    return this.weighingStationsRepository.save(entity);
  }

  async softDelete(actor: JwtPayloadType, id: string): Promise<void> {
    await this.opsAuthorizationService.assertAdminOrOwnsWeighingStation(
      actor,
      id,
    );

    const entity = await this.weighingStationsRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException({ error: 'weighing station not found' });
    }

    await this.weighingStationsRepository.softDelete(id);
  }
}
