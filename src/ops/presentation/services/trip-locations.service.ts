import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';
import { TripStatusEnum } from '../../domain/trip-status.enum';
import { CreateVehicleLocationDto } from '../../dto/create-vehicle-location.dto';
import { QueryTripLocationsDto } from '../../dto/query-trip-locations.dto';
import { VehicleLocationPointDto } from '../../dto/vehicle-location-point.dto';
import { TripEntity } from '../../infrastructure/persistence/relational/entities/trip.entity';
import { VehicleLocationEntity } from '../../infrastructure/persistence/relational/entities/vehicle-location.entity';
import { OpsAuthorizationService } from './ops-authorization.service';
import { LocationCacheService } from './location-cache.service';
import { TripsService } from './trips.service';

@Injectable()
export class TripLocationsService {
  constructor(
    @InjectRepository(TripEntity)
    private readonly tripsRepository: Repository<TripEntity>,
    @InjectRepository(VehicleLocationEntity)
    private readonly vehicleLocationsRepository: Repository<VehicleLocationEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
    private readonly locationCacheService: LocationCacheService,
    private readonly tripsService: TripsService,
  ) {}

  async createTripLocation(
    actor: JwtPayloadType,
    tripId: string,
    dto: CreateVehicleLocationDto,
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
      80,
    );
    if (!ok) {
      throw new UnprocessableEntityException({ error: 'locationRateLimited' });
    }

    const trip = await this.tripsRepository.findOne({
      where: { id: tripId, driver: { id: Number(actor.id) } },
      relations: ['driver'],
    });
    if (!trip) {
      throw new NotFoundException({ error: 'tripNotFound' });
    }

    if (trip.status !== TripStatusEnum.inProgress) {
      throw new UnprocessableEntityException({
        error: 'tripMustBeInProgressToTrackLocation',
      });
    }

    const ts = dto.timestamp ? new Date(dto.timestamp) : new Date();

    const created = this.vehicleLocationsRepository.create({
      driver: { id: actor.id } as any,
      trip: { id: tripId } as any,
      latitude: dto.latitude.toString(),
      longitude: dto.longitude.toString(),
      speed: dto.speed != null ? dto.speed.toString() : null,
      accuracy: dto.accuracy != null ? dto.accuracy.toString() : null,
      timestamp: ts,
    });
    await this.vehicleLocationsRepository.save(created);

    const loc = {
      latitude: dto.latitude,
      longitude: dto.longitude,
      timestamp: ts.toISOString(),
      accuracy: dto.accuracy ?? null,
      speed: dto.speed ?? null,
    };

    await this.locationCacheService.setTripLastLocation(tripId, loc);
    await this.locationCacheService.setDriverLastLocation(
      Number(actor.id),
      loc,
    );
  }

  async listVehicleLocations(
    actor: JwtPayloadType,
    tripId: string,
    query: QueryTripLocationsDto,
  ): Promise<InfinityPaginationResponseDto<VehicleLocationPointDto>> {
    await this.tripsService.getTripForReadAccess(actor, tripId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const qb = this.vehicleLocationsRepository
      .createQueryBuilder('vl')
      .where('vl.trip_id = :tripId', { tripId })
      .orderBy('vl.timestamp', 'ASC')
      .skip(skip)
      .take(limit);

    if (query.timestampFrom) {
      qb.andWhere('vl.timestamp >= :tf', {
        tf: new Date(query.timestampFrom),
      });
    }
    if (query.timestampTo) {
      qb.andWhere('vl.timestamp <= :tt', {
        tt: new Date(query.timestampTo),
      });
    }

    const rows = await qb.getMany();
    const data = rows.map((vl) => this.toVehiclePoint(vl));

    return infinityPagination(data, { page, limit });
  }

  private toVehiclePoint(vl: VehicleLocationEntity): VehicleLocationPointDto {
    return {
      id: vl.id,
      latitude: Number(vl.latitude),
      longitude: Number(vl.longitude),
      speed: vl.speed != null ? Number(vl.speed) : null,
      accuracy: vl.accuracy != null ? Number(vl.accuracy) : null,
      timestamp: new Date(vl.timestamp).toISOString(),
    };
  }
}
