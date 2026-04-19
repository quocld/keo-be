import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { FilesService } from '../../../files/files.service';
import { FileType } from '../../../files/domain/file';
import { ReceiptStatusEnum } from '../../domain/receipt-status.enum';
import { SubmitReceiptDto } from '../../dto/submit-receipt.dto';
import { RejectReceiptDto } from '../../dto/reject-receipt.dto';
import { ApproveReceiptDto } from '../../dto/approve-receipt.dto';
import { QueryReceiptDto } from '../../dto/query-receipt.dto';
import { QueryReceiptsByWeighingStationDto } from '../../dto/query-receipts-by-weighing-station.dto';
import { QueryReceiptsByHarvestAreaDto } from '../../dto/query-receipts-by-harvest-area.dto';
import { HarvestAreaReceiptSummaryDto } from '../../dto/harvest-area-receipt-summary.response.dto';
import { ReceiptEntity } from '../../infrastructure/persistence/relational/entities/receipt.entity';
import { ReceiptImageEntity } from '../../infrastructure/persistence/relational/entities/receipt-image.entity';
import { FinanceRecordEntity } from '../../infrastructure/persistence/relational/entities/finance-record.entity';
import { HarvestAreaEntity } from '../../infrastructure/persistence/relational/entities/harvest-area.entity';
import { WeighingStationEntity } from '../../infrastructure/persistence/relational/entities/weighing-station.entity';
import { TripEntity } from '../../infrastructure/persistence/relational/entities/trip.entity';
import { TripStatusEnum } from '../../domain/trip-status.enum';
import { OpsAuthorizationService } from './ops-authorization.service';
import { infinityPagination } from '../../../utils/infinity-pagination';
import { InfinityPaginationResponseDto } from '../../../utils/dto/infinity-pagination-response.dto';
import { NotificationsService } from '../../../notifications/presentation/services/notifications.service';
import { WeighingStationsService } from './weighing-stations.service';
import { HarvestAreasService } from './harvest-areas.service';
import { UserEntity } from '../../../users/infrastructure/persistence/relational/entities/user.entity';

function revenueFromReceiptAmount(amountStr: string): string {
  const a = Number(amountStr);
  if (!Number.isFinite(a)) {
    throw new UnprocessableEntityException({ error: 'invalidRevenueInputs' });
  }
  const cents = Math.round(a * 100);
  return (cents / 100).toFixed(2);
}

/** "12.5 tấn" / "13 tấn" */
function fmtTons(val: number | string): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return '';
  const s = parseFloat(n.toFixed(3)).toString();
  return `${s} tấn`;
}

/** "50 triệu" / "12.5 triệu" */
function fmtMillions(val: number | string): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return '';
  const m = n / 1_000_000;
  const s = m % 1 === 0 ? m.toFixed(0) : parseFloat(m.toFixed(2)).toString();
  return `${s} triệu`;
}

function driverDisplayName(
  user:
    | { firstName?: string | null; lastName?: string | null }
    | null
    | undefined,
): string {
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Tài xế';
}

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(ReceiptEntity)
    private readonly receiptsRepository: Repository<ReceiptEntity>,
    @InjectRepository(WeighingStationEntity)
    private readonly weighingStationsRepository: Repository<WeighingStationEntity>,
    @InjectRepository(TripEntity)
    private readonly tripsRepository: Repository<TripEntity>,
    @InjectRepository(HarvestAreaEntity)
    private readonly harvestAreasRepository: Repository<HarvestAreaEntity>,
    private readonly opsAuthorizationService: OpsAuthorizationService,
    private readonly filesService: FilesService,
    private readonly notificationsService: NotificationsService,
    private readonly weighingStationsService: WeighingStationsService,
    private readonly harvestAreasService: HarvestAreasService,
  ) {}

  async findMany(
    actor: JwtPayloadType,
    query: QueryReceiptDto,
  ): Promise<InfinityPaginationResponseDto<ReceiptEntity>> {
    if (
      !this.opsAuthorizationService.isDriver(actor) &&
      !this.opsAuthorizationService.isOwner(actor) &&
      !this.opsAuthorizationService.isAdmin(actor)
    ) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const qb = this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.images', 'img')
      .leftJoinAndSelect('r.harvestArea', 'ha')
      .leftJoinAndSelect('r.weighingStation', 'ws')
      .leftJoinAndSelect('r.driver', 'dr')
      .leftJoinAndSelect('r.financeRecord', 'fr')
      .orderBy('r.receiptDate', 'DESC')
      .skip(skip)
      .take(limit);

    if (this.opsAuthorizationService.isDriver(actor)) {
      qb.andWhere('r.driver_id = :driverId', { driverId: actor.id });
    } else if (this.opsAuthorizationService.isOwner(actor)) {
      qb.andWhere('ha.owner_id = :ownerId', { ownerId: Number(actor.id) });
    }

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    if (query.receiptDateFrom) {
      qb.andWhere('r.receipt_date >= :from', {
        from: new Date(query.receiptDateFrom),
      });
    }

    if (query.receiptDateTo) {
      qb.andWhere('r.receipt_date <= :to', {
        to: new Date(query.receiptDateTo),
      });
    }

    if (query.harvestAreaId && this.opsAuthorizationService.isAdmin(actor)) {
      qb.andWhere('r.harvest_area_id = :haId', {
        haId: query.harvestAreaId,
      });
    }

    const data = await qb.getMany();

    await Promise.all(data.map((r) => this.hydrateReceiptImageUrls(r)));

    return infinityPagination(data, { page, limit });
  }

  async findManyByWeighingStation(
    actor: JwtPayloadType,
    weighingStationId: string,
    query: QueryReceiptsByWeighingStationDto,
  ): Promise<InfinityPaginationResponseDto<ReceiptEntity>> {
    if (
      !this.opsAuthorizationService.isDriver(actor) &&
      !this.opsAuthorizationService.isOwner(actor) &&
      !this.opsAuthorizationService.isAdmin(actor)
    ) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    await this.weighingStationsService.findOne(actor, weighingStationId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const qb = this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.images', 'img')
      .leftJoinAndSelect('r.harvestArea', 'ha')
      .leftJoinAndSelect('r.weighingStation', 'ws')
      .leftJoinAndSelect('r.driver', 'dr')
      .leftJoinAndSelect('r.financeRecord', 'fr')
      .leftJoin('r.trip', 't')
      .andWhere(
        '(r.weighing_station_id = :wsId OR t.weighing_station_id = :wsId)',
        { wsId: weighingStationId },
      )
      .orderBy('r.receiptDate', 'DESC')
      .skip(skip)
      .take(limit);

    if (this.opsAuthorizationService.isDriver(actor)) {
      qb.andWhere('r.driver_id = :driverId', { driverId: actor.id });
    } else if (this.opsAuthorizationService.isOwner(actor)) {
      qb.andWhere('ha.owner_id = :ownerId', { ownerId: Number(actor.id) });
    }

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    if (query.receiptDateFrom) {
      qb.andWhere('r.receipt_date >= :from', {
        from: new Date(query.receiptDateFrom),
      });
    }

    if (query.receiptDateTo) {
      qb.andWhere('r.receipt_date <= :to', {
        to: new Date(query.receiptDateTo),
      });
    }

    const data = await qb.getMany();

    await Promise.all(data.map((r) => this.hydrateReceiptImageUrls(r)));

    return infinityPagination(data, { page, limit });
  }

  async findManyByHarvestArea(
    actor: JwtPayloadType,
    harvestAreaId: string,
    query: QueryReceiptsByHarvestAreaDto,
  ): Promise<InfinityPaginationResponseDto<ReceiptEntity>> {
    if (
      !this.opsAuthorizationService.isDriver(actor) &&
      !this.opsAuthorizationService.isOwner(actor) &&
      !this.opsAuthorizationService.isAdmin(actor)
    ) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    // Verify the actor has access to this harvest area (throws 403/404 if not)
    await this.harvestAreasService.findOne(actor, harvestAreaId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const qb = this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.images', 'img')
      .leftJoinAndSelect('r.harvestArea', 'ha')
      .leftJoinAndSelect('r.weighingStation', 'ws')
      .leftJoinAndSelect('r.driver', 'dr')
      .leftJoinAndSelect('r.financeRecord', 'fr')
      .where('r.harvest_area_id = :haId', { haId: harvestAreaId })
      .orderBy('r.receiptDate', 'DESC')
      .skip(skip)
      .take(limit);

    if (this.opsAuthorizationService.isDriver(actor)) {
      qb.andWhere('r.driver_id = :driverId', { driverId: actor.id });
    }

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    if (query.receiptDateFrom) {
      qb.andWhere('r.receipt_date >= :from', {
        from: new Date(query.receiptDateFrom),
      });
    }

    if (query.receiptDateTo) {
      qb.andWhere('r.receipt_date <= :to', {
        to: new Date(query.receiptDateTo),
      });
    }

    const data = await qb.getMany();

    await Promise.all(data.map((r) => this.hydrateReceiptImageUrls(r)));

    return infinityPagination(data, { page, limit });
  }

  async getReceiptSummaryByHarvestArea(
    actor: JwtPayloadType,
    harvestAreaId: string,
  ): Promise<HarvestAreaReceiptSummaryDto> {
    if (
      !this.opsAuthorizationService.isDriver(actor) &&
      !this.opsAuthorizationService.isOwner(actor) &&
      !this.opsAuthorizationService.isAdmin(actor)
    ) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    // Verify the actor has access to this harvest area (throws 403/404 if not)
    await this.harvestAreasService.findOne(actor, harvestAreaId);

    const qb = this.receiptsRepository
      .createQueryBuilder('r')
      .select('COUNT(*) FILTER (WHERE r.status = :approved)', 'approvedCount')
      .addSelect(
        'COALESCE(SUM(r.weight::numeric) FILTER (WHERE r.status = :approved), 0)',
        'approvedTotalWeight',
      )
      .addSelect(
        'COALESCE(SUM(r.amount::numeric) FILTER (WHERE r.status = :approved), 0)',
        'approvedTotalAmount',
      )
      .addSelect('COUNT(*) FILTER (WHERE r.status = :pending)', 'pendingCount')
      .addSelect('COUNT(*)', 'totalCount')
      .where('r.harvest_area_id = :haId', { haId: harvestAreaId })
      .andWhere('r.deleted_at IS NULL')
      .setParameter('approved', ReceiptStatusEnum.approved)
      .setParameter('pending', ReceiptStatusEnum.pending);

    if (this.opsAuthorizationService.isDriver(actor)) {
      qb.andWhere('r.driver_id = :driverId', { driverId: actor.id });
    }

    const row = await qb.getRawOne<Record<string, string>>();

    return {
      approvedCount: Number(row?.approvedCount ?? 0),
      approvedTotalWeight: Number(row?.approvedTotalWeight ?? 0),
      approvedTotalAmount: Number(row?.approvedTotalAmount ?? 0),
      pendingCount: Number(row?.pendingCount ?? 0),
      totalCount: Number(row?.totalCount ?? 0),
    };
  }

  async findOne(
    actor: JwtPayloadType,
    receiptId: string,
  ): Promise<ReceiptEntity> {
    if (
      !this.opsAuthorizationService.isDriver(actor) &&
      !this.opsAuthorizationService.isOwner(actor) &&
      !this.opsAuthorizationService.isAdmin(actor)
    ) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    const receipt = await this.receiptsRepository.findOne({
      where: { id: receiptId },
      relations: [
        'images',
        'harvestArea',
        'weighingStation',
        'driver',
        'financeRecord',
        'trip',
        'approvedBy',
      ],
    });

    if (!receipt) {
      throw new NotFoundException({ error: 'receiptNotFound' });
    }

    if (this.opsAuthorizationService.isAdmin(actor)) {
      await this.hydrateReceiptImageUrls(receipt);
      return receipt;
    }

    if (this.opsAuthorizationService.isDriver(actor)) {
      if (Number(receipt.driver.id) !== Number(actor.id)) {
        throw new NotFoundException({ error: 'receiptNotFound' });
      }
      await this.hydrateReceiptImageUrls(receipt);
      return receipt;
    }

    try {
      await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(
        actor,
        receipt.harvestArea.id,
      );
    } catch (e) {
      if (e instanceof ForbiddenException) {
        throw new NotFoundException({ error: 'receiptNotFound' });
      }
      throw e;
    }

    await this.hydrateReceiptImageUrls(receipt);
    return receipt;
  }

  private async hydrateReceiptImageUrls(receipt: ReceiptEntity): Promise<void> {
    if (!receipt.images?.length) {
      return;
    }
    await Promise.all(
      receipt.images.map(async (img) => {
        img.imageUrl = await this.filesService.resolveReceiptImageUrlForView(
          img.imageUrl,
        );
      }),
    );
  }

  async submit(actor: JwtPayloadType, dto: SubmitReceiptDto) {
    const isDriver = this.opsAuthorizationService.isDriver(actor);
    const isOwner = this.opsAuthorizationService.isOwner(actor);

    if (!isDriver && !isOwner) {
      throw new ForbiddenException({ error: 'forbidden' });
    }

    if (isDriver && dto.driverUserId != null) {
      throw new UnprocessableEntityException({
        error: 'driverUserIdNotAllowed',
      });
    }

    if (isOwner && dto.driverUserId == null) {
      throw new UnprocessableEntityException({
        error: 'driverUserIdRequired',
      });
    }

    const driverUserIdForReceipt = isDriver
      ? Number(actor.id)
      : Number(dto.driverUserId);

    const fileIds = dto.imageFileIds?.filter(Boolean) ?? [];
    const files = await this.filesService.findByIds(fileIds);

    if (files.length !== fileIds.length) {
      throw new UnprocessableEntityException({
        error: 'receiptImageFileNotFound',
      });
    }

    const byId = new Map(files.map((f) => [f.id, f]));
    const orderedFiles = fileIds
      .map((id) => byId.get(id))
      .filter((f): f is FileType => f != null);

    const resolvedFromFiles = orderedFiles.map((f) => f.path);

    const imageUrlsFromClient = (dto.imageUrls ?? []).filter((u) => u?.trim());
    if (dto.receiptImageUrl?.trim()) {
      imageUrlsFromClient.push(dto.receiptImageUrl.trim());
    }

    const allImageUrls = [...resolvedFromFiles, ...imageUrlsFromClient];

    let weighingStationIdToUse: string | null = dto.weighingStationId ?? null;
    let tripIdToUse: string | null = null;

    if (dto.tripId) {
      const trip = await this.tripsRepository.findOne({
        where: { id: dto.tripId },
        relations: ['driver', 'harvestArea', 'weighingStation'],
      });

      if (!trip) {
        throw new UnprocessableEntityException({ error: 'tripNotFound' });
      }

      if (Number(trip.driver.id) !== driverUserIdForReceipt) {
        throw new ForbiddenException({ error: 'forbidden' });
      }

      if (trip.harvestArea.id !== dto.harvestAreaId) {
        throw new UnprocessableEntityException({
          error: 'receiptTripHarvestMismatch',
        });
      }

      if (trip.status !== TripStatusEnum.inProgress) {
        throw new UnprocessableEntityException({
          error: 'tripNotInProgressForReceipt',
        });
      }

      if (
        dto.weighingStationId &&
        dto.weighingStationId !== trip.weighingStation.id
      ) {
        throw new UnprocessableEntityException({
          error: 'receiptTripWeighingMismatch',
        });
      }

      weighingStationIdToUse = trip.weighingStation.id;
      tripIdToUse = trip.id;
    }

    if (isDriver) {
      await this.opsAuthorizationService.assertDriverHarvestAndWeighingForOps(
        actor,
        dto.harvestAreaId,
        weighingStationIdToUse,
      );
    } else {
      await this.opsAuthorizationService.assertOwnerHarvestAndWeighingForManagedDriver(
        actor,
        driverUserIdForReceipt,
        dto.harvestAreaId,
        weighingStationIdToUse,
      );
    }

    const submitted = await this.receiptsRepository.manager.transaction(
      async (em) => {
        const receiptRepo = em.getRepository(ReceiptEntity);
        const imageRepo = em.getRepository(ReceiptImageEntity);

        const receipt = receiptRepo.create({
          trip: tripIdToUse ? ({ id: tripIdToUse } as any) : null,
          driver: { id: driverUserIdForReceipt } as any,
          harvestArea: { id: dto.harvestAreaId } as any,
          weighingStation: weighingStationIdToUse
            ? ({ id: weighingStationIdToUse } as any)
            : null,
          weight: dto.weight.toString(),
          amount: dto.amount.toString(),
          receiptDate: new Date(dto.receiptDate),
          billCode: dto.billCode ?? null,
          notes: dto.notes ?? null,
          status: ReceiptStatusEnum.pending,
          submittedAt: new Date(),
        });

        const saved = await receiptRepo.save(receipt);

        const imageEntities = allImageUrls.map((url, index) =>
          imageRepo.create({
            receipt: saved,
            imageUrl: url,
            isPrimary: index === 0,
          }),
        );
        await imageRepo.save(imageEntities);

        return receiptRepo.findOneOrFail({
          where: { id: saved.id },
          relations: ['images'],
        });
      },
    );

    await this.hydrateReceiptImageUrls(submitted);

    const harvestArea = await this.harvestAreasRepository.findOne({
      where: { id: dto.harvestAreaId },
      relations: ['owner'],
    });

    const ownerId = harvestArea?.owner?.id;
    if (ownerId) {
      // Load driver name and station name for human-readable message.
      const driverUser = await this.receiptsRepository.manager.findOne(
        UserEntity,
        {
          where: { id: driverUserIdForReceipt },
          select: ['firstName', 'lastName'],
        },
      );
      let stationName: string | null = null;
      if (weighingStationIdToUse) {
        const station = await this.weighingStationsRepository.findOne({
          where: { id: weighingStationIdToUse },
          select: ['name'],
        });
        stationName = station?.name ?? null;
      }
      const name = driverDisplayName(driverUser);
      const stationPart = stationName ? ` tại ${stationName}` : '';
      await this.notificationsService.createNotificationAndEnqueue({
        userId: Number(ownerId),
        title: 'Phiếu cân mới',
        message: `${name} vừa gửi ${fmtTons(dto.weight)}, ${fmtMillions(dto.amount)}${stationPart}`,
        type: 'receipt_created',
        referenceId: submitted.id,
        pushData: {
          type: 'receipt_created',
          receiptId: submitted.id,
          status: 'pending',
        },
      });
    }

    return submitted;
  }

  async approve(
    actor: JwtPayloadType,
    receiptId: string,
    dto: ApproveReceiptDto,
  ) {
    this.opsAuthorizationService.assertAdminOrOwner(actor);

    const receipt = await this.receiptsRepository.findOne({
      where: { id: receiptId },
      relations: [
        'driver',
        'harvestArea',
        'harvestArea.owner',
        'weighingStation',
        'trip',
        'trip.weighingStation',
        'financeRecord',
      ],
    });

    if (!receipt) {
      throw new NotFoundException({ error: 'receiptNotFound' });
    }

    if (receipt.status !== ReceiptStatusEnum.pending) {
      throw new UnprocessableEntityException({
        error: 'receiptMustBePending',
      });
    }

    await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(
      actor,
      receipt.harvestArea.id,
    );

    const approved = await this.receiptsRepository.manager.transaction(
      async (em) => {
        const receiptRepo = em.getRepository(ReceiptEntity);
        const financeRepo = em.getRepository(FinanceRecordEntity);

        const row = await receiptRepo.findOne({
          where: { id: receiptId },
          relations: [
            'weighingStation',
            'trip',
            'trip.weighingStation',
            'financeRecord',
          ],
        });

        if (!row || row.status !== ReceiptStatusEnum.pending) {
          throw new UnprocessableEntityException({
            error: 'receiptMustBePending',
          });
        }

        const existingFinance = await financeRepo.findOne({
          where: { receipt: { id: receiptId } },
        });

        if (existingFinance) {
          return receiptRepo.findOneOrFail({
            where: { id: receiptId },
            relations: [
              'images',
              'financeRecord',
              'weighingStation',
              'harvestArea',
            ],
          });
        }

        let resolvedStation: WeighingStationEntity | null =
          row.weighingStation ?? null;

        if (!resolvedStation && row.trip?.weighingStation) {
          resolvedStation = row.trip.weighingStation;
        }

        if (!resolvedStation && dto.weighingStationId) {
          resolvedStation = await this.weighingStationsRepository.findOne({
            where: { id: dto.weighingStationId },
          });
          if (!resolvedStation) {
            throw new UnprocessableEntityException({
              error: 'weighingStationNotFound',
            });
          }
        }

        if (!resolvedStation) {
          throw new UnprocessableEntityException({
            error: 'weighingStationRequiredForApproval',
          });
        }

        if (resolvedStation.status !== 'active') {
          throw new UnprocessableEntityException({
            error: 'weighingStationInactive',
          });
        }

        if (!row.weighingStation) {
          row.weighingStation = resolvedStation;
        }

        const revenue = revenueFromReceiptAmount(row.amount);

        row.status = ReceiptStatusEnum.approved;
        row.approvedBy = { id: actor.id } as any;
        row.approvedAt = new Date();
        row.rejectedReason = null;

        await receiptRepo.save(row);

        await financeRepo.save(
          financeRepo.create({
            receipt: row,
            revenue,
            costDriver: '0',
            costHarvest: '0',
            otherCost: '0',
            calculatedAt: row.receiptDate,
          }),
        );

        if (row.trip?.id) {
          const tripRepo = em.getRepository(TripEntity);
          const tripEntity = await tripRepo.findOne({
            where: { id: row.trip.id },
          });
          if (tripEntity) {
            const nextTons = Number(tripEntity.totalTons) + Number(row.weight);
            tripEntity.totalTons = (Math.round(nextTons * 100) / 100).toFixed(
              2,
            );
            tripEntity.totalReceipts += 1;
            await tripRepo.save(tripEntity);
          }
        }

        // Cộng trọng lượng phiếu vào current_tons của khu khai thác
        const haRepo = em.getRepository(HarvestAreaEntity);
        const haEntity = await haRepo.findOne({
          where: { id: receipt.harvestArea.id },
        });
        if (haEntity) {
          const nextHaTons = Number(haEntity.currentTons) + Number(row.weight);
          haEntity.currentTons = (Math.round(nextHaTons * 100) / 100).toFixed(
            2,
          );
          await haRepo.save(haEntity);
        }

        return receiptRepo.findOneOrFail({
          where: { id: receiptId },
          relations: [
            'images',
            'financeRecord',
            'weighingStation',
            'harvestArea',
          ],
        });
      },
    );

    await this.hydrateReceiptImageUrls(approved);

    const driverId = receipt.driver?.id;
    if (driverId) {
      const stationName = approved.weighingStation?.name ?? null;
      const stationPart = stationName ? ` tại ${stationName}` : '';
      await this.notificationsService.createNotificationAndEnqueue({
        userId: Number(driverId),
        title: 'Phiếu cân được duyệt',
        message: `Phiếu của bạn đã được duyệt: ${fmtTons(approved.weight)}, ${fmtMillions(approved.amount)}${stationPart}`,
        type: 'receipt_approved',
        referenceId: approved.id,
        pushData: {
          type: 'receipt_approved',
          receiptId: approved.id,
          status: 'approved',
        },
      });
    }

    return approved;
  }

  async reject(
    actor: JwtPayloadType,
    receiptId: string,
    dto: RejectReceiptDto,
  ) {
    this.opsAuthorizationService.assertAdminOrOwner(actor);

    const receipt = await this.receiptsRepository.findOne({
      where: { id: receiptId },
      relations: ['driver', 'harvestArea', 'harvestArea.owner'],
    });

    if (!receipt) {
      throw new NotFoundException({ error: 'receiptNotFound' });
    }

    if (receipt.status !== ReceiptStatusEnum.pending) {
      throw new UnprocessableEntityException({
        error: 'receiptMustBePending',
      });
    }

    await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(
      actor,
      receipt.harvestArea.id,
    );

    receipt.status = ReceiptStatusEnum.rejected;
    receipt.approvedBy = null;
    receipt.approvedAt = null;
    receipt.rejectedReason = dto.rejectedReason;

    const saved = await this.receiptsRepository.save(receipt);

    const driverId = saved.driver?.id ?? receipt.driver?.id;
    if (driverId) {
      const reason = dto.rejectedReason?.trim();
      const reasonPart = reason ? ` Lý do: ${reason}` : '';
      await this.notificationsService.createNotificationAndEnqueue({
        userId: Number(driverId),
        title: 'Phiếu cân bị từ chối',
        message: `Phiếu cân của bạn bị từ chối.${reasonPart}`,
        type: 'receipt_rejected',
        referenceId: saved.id,
        pushData: {
          type: 'receipt_rejected',
          receiptId: saved.id,
          status: 'rejected',
        },
      });
    }

    return saved;
  }
}
