import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';
import { DriverLocationPointDto } from '../../dto/driver-location-point.dto';
import { QueryDriverLocationHistoryDto } from '../../dto/query-driver-location-history.dto';
import { DriverLocationEntity } from '../../infrastructure/persistence/relational/entities/driver-location.entity';
import { CreateDriverLocationDto } from '../../dto/create-driver-location.dto';
import { OpsAuthorizationService } from './ops-authorization.service';
import { LocationCacheService } from './location-cache.service';

@Injectable()
export class DriverLocationsService {
  constructor(
    @InjectRepository(DriverLocationEntity)
    private readonly driverLocationsRepository: Repository<DriverLocationEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
    private readonly locationCacheService: LocationCacheService,
  ) {}

  async createMyLocation(
    actor: JwtPayloadType,
    dto: CreateDriverLocationDto,
  ): Promise<void> {
    this.opsAuthorizationService.assertDriver(actor);

    if (dto.accuracy != null && dto.accuracy > 200) {
      throw new UnprocessableEntityException({
        error: 'locationAccuracyTooLow',
      });
    }

    const ok = await this.locationCacheService.rateLimitDriver(
      Number(actor.id),
      10,
      50,
    );
    if (!ok) {
      throw new UnprocessableEntityException({ error: 'locationRateLimited' });
    }

    const ts = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const created = this.driverLocationsRepository.create({
      driver: { id: actor.id } as any,
      latitude: dto.latitude.toString(),
      longitude: dto.longitude.toString(),
      speed: dto.speed != null ? dto.speed.toString() : null,
      accuracy: dto.accuracy != null ? dto.accuracy.toString() : null,
      timestamp: ts,
    });
    await this.driverLocationsRepository.save(created);

    await this.locationCacheService.setDriverLastLocation(Number(actor.id), {
      latitude: dto.latitude,
      longitude: dto.longitude,
      timestamp: ts.toISOString(),
      accuracy: dto.accuracy ?? null,
      speed: dto.speed ?? null,
    });
  }

  async listMyLocations(
    actor: JwtPayloadType,
    query: QueryDriverLocationHistoryDto,
  ): Promise<InfinityPaginationResponseDto<DriverLocationPointDto>> {
    this.opsAuthorizationService.assertDriver(actor);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;
    const driverId = Number(actor.id);

    const qb = this.driverLocationsRepository
      .createQueryBuilder('dl')
      .where('dl.driver_id = :driverId', { driverId })
      .orderBy('dl.timestamp', 'ASC')
      .skip(skip)
      .take(limit);

    if (query.timestampFrom) {
      qb.andWhere('dl.timestamp >= :tf', {
        tf: new Date(query.timestampFrom),
      });
    }
    if (query.timestampTo) {
      qb.andWhere('dl.timestamp <= :tt', {
        tt: new Date(query.timestampTo),
      });
    }

    const rows = await qb.getMany();
    const data = rows.map((dl) => this.toDriverPoint(dl));

    return infinityPagination(data, { page, limit });
  }

  private toDriverPoint(dl: DriverLocationEntity): DriverLocationPointDto {
    return {
      id: dl.id,
      latitude: Number(dl.latitude),
      longitude: Number(dl.longitude),
      speed: dl.speed != null ? Number(dl.speed) : null,
      accuracy: dl.accuracy != null ? Number(dl.accuracy) : null,
      timestamp: new Date(dl.timestamp).toISOString(),
    };
  }
}
