import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { TripStatusEnum } from '../../domain/trip-status.enum';
import { CreateTripDto } from '../../dto/create-trip.dto';
import { QueryTripDto } from '../../dto/query-trip.dto';
import { TripEntity } from '../../infrastructure/persistence/relational/entities/trip.entity';
import { WeighingStationEntity } from '../../infrastructure/persistence/relational/entities/weighing-station.entity';
import { OpsAuthorizationService } from './ops-authorization.service';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(TripEntity)
    private readonly tripsRepository: Repository<TripEntity>,
    @InjectRepository(WeighingStationEntity)
    private readonly weighingStationsRepository: Repository<WeighingStationEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
  ) {}

  private async assertDriverHasNoInProgressTrip(
    driverId: number,
    excludeTripId?: string,
  ): Promise<void> {
    const qb = this.tripsRepository
      .createQueryBuilder('t')
      .where('t.driver_id = :driverId', { driverId })
      .andWhere('t.status = :st', { st: TripStatusEnum.inProgress });

    if (excludeTripId) {
      qb.andWhere('t.id != :excludeTripId', { excludeTripId });
    }

    const count = await qb.getCount();
    if (count > 0) {
      throw new UnprocessableEntityException({
        error: 'driverAlreadyHasInProgressTrip',
      });
    }
  }

  async create(actor: JwtPayloadType, dto: CreateTripDto): Promise<TripEntity> {
    this.opsAuthorizationService.assertDriver(actor);

    const weighingStation = await this.weighingStationsRepository.findOne({
      where: { id: dto.weighingStationId },
    });

    if (!weighingStation) {
      throw new UnprocessableEntityException({
        error: 'weighingStationNotFound',
      });
    }

    if (weighingStation.status !== 'active') {
      throw new UnprocessableEntityException({
        error: 'weighingStationInactive',
      });
    }

    await this.opsAuthorizationService.assertDriverHarvestAndWeighingForOps(
      actor,
      dto.harvestAreaId,
      dto.weighingStationId,
    );

    const startNow = dto.startNow === true;

    if (startNow) {
      await this.assertDriverHasNoInProgressTrip(Number(actor.id));
    }

    const trip = this.tripsRepository.create({
      driver: { id: actor.id } as any,
      harvestArea: { id: dto.harvestAreaId } as any,
      weighingStation: { id: dto.weighingStationId } as any,
      estimatedDistance:
        dto.estimatedDistance !== undefined
          ? dto.estimatedDistance.toString()
          : null,
      status: startNow ? TripStatusEnum.inProgress : TripStatusEnum.planned,
      startTime: startNow ? new Date() : null,
      endTime: null,
      totalTons: '0',
      totalReceipts: 0,
    });

    return this.tripsRepository.save(trip);
  }

  async start(actor: JwtPayloadType, tripId: string): Promise<TripEntity> {
    this.opsAuthorizationService.assertDriver(actor);

    const trip = await this.tripsRepository.findOne({
      where: { id: tripId, driver: { id: Number(actor.id) } },
    });

    if (!trip) {
      throw new NotFoundException({ error: 'tripNotFound' });
    }

    if (trip.status !== TripStatusEnum.planned) {
      throw new UnprocessableEntityException({
        error: 'tripMustBePlannedToStart',
      });
    }

    await this.assertDriverHasNoInProgressTrip(Number(actor.id));

    trip.status = TripStatusEnum.inProgress;
    trip.startTime = new Date();

    return this.tripsRepository.save(trip);
  }

  async complete(actor: JwtPayloadType, tripId: string): Promise<TripEntity> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId },
      relations: ['harvestArea', 'harvestArea.owner', 'driver'],
    });

    if (!trip) {
      throw new NotFoundException({ error: 'tripNotFound' });
    }

    await this.assertCanManageTripLifecycle(actor, trip);

    if (trip.status !== TripStatusEnum.inProgress) {
      throw new UnprocessableEntityException({
        error: 'tripMustBeInProgressToComplete',
      });
    }

    trip.status = TripStatusEnum.completed;
    trip.endTime = new Date();

    return this.tripsRepository.save(trip);
  }

  async cancel(actor: JwtPayloadType, tripId: string): Promise<TripEntity> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId },
      relations: ['harvestArea', 'harvestArea.owner', 'driver'],
    });

    if (!trip) {
      throw new NotFoundException({ error: 'tripNotFound' });
    }

    await this.assertCanManageTripLifecycle(actor, trip);

    if (
      trip.status !== TripStatusEnum.planned &&
      trip.status !== TripStatusEnum.inProgress
    ) {
      throw new UnprocessableEntityException({
        error: 'tripCannotBeCancelled',
      });
    }

    trip.status = TripStatusEnum.cancelled;
    trip.endTime = new Date();

    return this.tripsRepository.save(trip);
  }

  private async assertCanManageTripLifecycle(
    actor: JwtPayloadType,
    trip: TripEntity,
  ): Promise<void> {
    if (this.opsAuthorizationService.isAdmin(actor)) {
      return;
    }

    if (this.opsAuthorizationService.isDriver(actor)) {
      if (Number(trip.driver.id) !== Number(actor.id)) {
        throw new ForbiddenException({ error: 'forbidden' });
      }
      return;
    }

    if (this.opsAuthorizationService.isOwner(actor)) {
      await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(
        actor,
        trip.harvestArea.id,
      );
      return;
    }

    throw new ForbiddenException({ error: 'forbidden' });
  }

  async findMany(
    actor: JwtPayloadType,
    query: QueryTripDto,
  ): Promise<InfinityPaginationResponseDto<TripEntity>> {
    if (
      !this.opsAuthorizationService.isDriver(actor) &&
      !this.opsAuthorizationService.isOwner(actor) &&
      !this.opsAuthorizationService.isAdmin(actor)
    ) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    if (query.harvestAreaId && !this.opsAuthorizationService.isAdmin(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    if (
      query.driverId != null &&
      !this.opsAuthorizationService.isAdmin(actor)
    ) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const qb = this.tripsRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.harvestArea', 'ha')
      .leftJoinAndSelect('t.weighingStation', 'ws')
      .leftJoinAndSelect('t.driver', 'dr')
      .orderBy('t.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (this.opsAuthorizationService.isDriver(actor)) {
      qb.andWhere('t.driver_id = :driverId', { driverId: actor.id });
    } else if (this.opsAuthorizationService.isOwner(actor)) {
      qb.andWhere('ha.owner_id = :ownerId', { ownerId: Number(actor.id) });
    }

    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }

    if (query.harvestAreaId && this.opsAuthorizationService.isAdmin(actor)) {
      qb.andWhere('t.harvest_area_id = :haId', {
        haId: query.harvestAreaId,
      });
    }

    if (query.driverId != null && this.opsAuthorizationService.isAdmin(actor)) {
      qb.andWhere('t.driver_id = :filterDriverId', {
        filterDriverId: query.driverId,
      });
    }

    if (query.createdAtFrom) {
      qb.andWhere('t.created_at >= :caf', {
        caf: new Date(query.createdAtFrom),
      });
    }

    if (query.createdAtTo) {
      qb.andWhere('t.created_at <= :cat', {
        cat: new Date(query.createdAtTo),
      });
    }

    const data = await qb.getMany();

    return infinityPagination(data, { page, limit });
  }
}
