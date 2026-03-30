import { InjectRepository } from '@nestjs/typeorm';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SelectQueryBuilder, Repository } from 'typeorm';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { OpsAuthorizationService } from '../../../ops/presentation/services/ops-authorization.service';
import { UserEntity } from '../../../users/infrastructure/persistence/relational/entities/user.entity';
import { HarvestAreaEntity } from '../../../ops/infrastructure/persistence/relational/entities/harvest-area.entity';
import { WeighingStationEntity } from '../../../ops/infrastructure/persistence/relational/entities/weighing-station.entity';
import { DriverHarvestAreaEntity } from '../../../ops/infrastructure/persistence/relational/entities/driver-harvest-area.entity';
import { FinanceRecordEntity } from '../../../ops/infrastructure/persistence/relational/entities/finance-record.entity';
import { ReceiptEntity } from '../../../ops/infrastructure/persistence/relational/entities/receipt.entity';
import { VehicleEntity } from '../../../ops/infrastructure/persistence/relational/entities/vehicle.entity';
import { TripEntity } from '../../../ops/infrastructure/persistence/relational/entities/trip.entity';
import { ReceiptStatusEnum } from '../../../ops/domain/receipt-status.enum';
import { TripStatusEnum } from '../../../ops/domain/trip-status.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly opsAuthorizationService: OpsAuthorizationService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(HarvestAreaEntity)
    private readonly harvestAreasRepository: Repository<HarvestAreaEntity>,
    @InjectRepository(WeighingStationEntity)
    private readonly weighingStationsRepository: Repository<WeighingStationEntity>,
    @InjectRepository(DriverHarvestAreaEntity)
    private readonly driverHarvestAreasRepository: Repository<DriverHarvestAreaEntity>,
    @InjectRepository(FinanceRecordEntity)
    private readonly financeRecordsRepository: Repository<FinanceRecordEntity>,
    @InjectRepository(ReceiptEntity)
    private readonly receiptsRepository: Repository<ReceiptEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehiclesRepository: Repository<VehicleEntity>,
    @InjectRepository(TripEntity)
    private readonly tripsRepository: Repository<TripEntity>,
  ) {}

  private resolveRoleScope(
    actor: JwtPayloadType,
  ): 'admin' | 'owner' | 'driver' {
    if (this.opsAuthorizationService.isAdmin(actor)) {
      return 'admin';
    }
    if (this.opsAuthorizationService.isOwner(actor)) {
      return 'owner';
    }
    // Default to driver because RolesGuard already restricts roles.
    return 'driver';
  }

  /**
   * Used for receipts aggregation:
   * - driver: filter by receipts.driver_id
   * - owner: filter by harvest_areas.owner_id (receipt -> harvest_area join)
   */
  applyReceiptScope(
    qb: SelectQueryBuilder<any>,
    actor: JwtPayloadType,
    aliases: { receiptAlias: string; harvestAreaAlias: string },
  ): void {
    const roleScope = this.resolveRoleScope(actor);

    if (roleScope === 'driver') {
      qb.andWhere(`${aliases.receiptAlias}.driver_id = :driverId`, {
        driverId: Number(actor.id),
      });
      return;
    }

    if (roleScope === 'owner') {
      qb.andWhere(`${aliases.harvestAreaAlias}.owner_id = :ownerId`, {
        ownerId: Number(actor.id),
      });
    }
  }

  /**
   * Used for trips aggregation:
   * - driver: filter by trips.driver_id
   * - owner: filter by harvest_areas.owner_id (trip -> harvest_area join)
   */
  applyTripScope(
    qb: SelectQueryBuilder<any>,
    actor: JwtPayloadType,
    aliases: { tripAlias: string; harvestAreaAlias: string },
  ): void {
    const roleScope = this.resolveRoleScope(actor);

    if (roleScope === 'driver') {
      qb.andWhere(`${aliases.tripAlias}.driver_id = :driverId`, {
        driverId: Number(actor.id),
      });
      return;
    }

    if (roleScope === 'owner') {
      qb.andWhere(`${aliases.harvestAreaAlias}.owner_id = :ownerId`, {
        ownerId: Number(actor.id),
      });
    }
  }

  /**
   * Used for finance aggregation:
   * finance_records -> receipt -> harvest_area for owner scope.
   */
  applyFinanceScope(
    qb: SelectQueryBuilder<any>,
    actor: JwtPayloadType,
    aliases: {
      financeAlias: string;
      receiptAlias: string;
      harvestAreaAlias: string;
    },
  ): void {
    const roleScope = this.resolveRoleScope(actor);
    if (roleScope === 'driver') {
      qb.andWhere(`${aliases.receiptAlias}.driver_id = :driverId`, {
        driverId: Number(actor.id),
      });
      return;
    }

    if (roleScope === 'owner') {
      qb.andWhere(`${aliases.harvestAreaAlias}.owner_id = :ownerId`, {
        ownerId: Number(actor.id),
      });
      return;
    }
  }

  async assertActorCanViewHarvestArea(
    actor: JwtPayloadType,
    harvestAreaId: string,
  ): Promise<void> {
    const roleScope = this.resolveRoleScope(actor);

    if (roleScope === 'admin') {
      return;
    }

    if (roleScope === 'owner') {
      await this.opsAuthorizationService.assertOwnerOwnsHarvestArea(
        actor,
        harvestAreaId,
      );
      return;
    }

    // driver
    await this.opsAuthorizationService.assertDriverAssignedToHarvestArea(
      actor,
      harvestAreaId,
    );
  }

  async assertActorCanViewWeighingStation(
    actor: JwtPayloadType,
    weighingStationId: string,
  ): Promise<void> {
    const roleScope = this.resolveRoleScope(actor);

    if (roleScope === 'admin') {
      return;
    }

    if (roleScope === 'owner') {
      await this.opsAuthorizationService.assertAdminOrOwnsWeighingStation(
        actor,
        weighingStationId,
      );
      return;
    }

    // driver
    await this.opsAuthorizationService.assertDriverMayUseWeighingStation(
      actor,
      weighingStationId,
    );
  }

  // Skeleton methods - will be fully implemented in subsequent to-dos.
  async getDashboardSummary(actor: JwtPayloadType, query: any): Promise<any> {
    const range = query?.range ?? 'today';

    const resolveTimeRange = (): { from: Date; to: Date } => {
      const now = new Date();
      if (range === 'custom') {
        const from = query?.from ? new Date(query.from) : now;
        const to = query?.to ? new Date(query.to) : now;
        return { from, to };
      }

      if (range === 'month') {
        const from = new Date(now);
        from.setDate(1);
        from.setHours(0, 0, 0, 0);

        const to = new Date(from);
        to.setMonth(from.getMonth() + 1);
        to.setMilliseconds(-1);
        return { from, to };
      }

      // today (default)
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);

      const to = new Date(now);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    };

    const { from, to } = resolveTimeRange();
    const roleScope = this.resolveRoleScope(actor);

    // Revenue/Profit totals and top drivers (from finance_records)
    const financeTotals = await this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .leftJoin('r.driver', 'd')
      .where('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
        from,
        to,
      });

    this.applyFinanceScope(financeTotals, actor, {
      financeAlias: 'fr',
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const totalsRaw = await financeTotals
      .select('COALESCE(SUM(fr.revenue), 0)', 'revenue')
      .addSelect('COALESCE(SUM(fr.profit), 0)', 'profit')
      .getRawOne<{ revenue: string; profit: string }>();

    // Pending receipts count (from receipts)
    const pendingQb = this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoin('r.harvestArea', 'ha')
      .where('r.status = :st', { st: ReceiptStatusEnum.pending })
      .andWhere('r.submitted_at >= :from AND r.submitted_at <= :to', {
        from,
        to,
      });

    this.applyReceiptScope(pendingQb, actor, {
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const pendingRaw = await pendingQb
      .select('COUNT(DISTINCT r.id)', 'count')
      .getRawOne<{ count: string }>();

    // Busy/Free vehicles: derived from current in_progress trips.
    const inProgressDrivers = await this.tripsRepository
      .createQueryBuilder('t')
      .leftJoin('t.harvestArea', 'ha')
      .select('t.driver.id', 'driverId')
      .where('t.status = :st', { st: TripStatusEnum.inProgress })
      .groupBy('t.driver.id');

    if (roleScope === 'owner') {
      inProgressDrivers.andWhere('ha.owner_id = :ownerId', {
        ownerId: Number(actor.id),
      });
    } else if (roleScope === 'driver') {
      inProgressDrivers.andWhere('t.driver.id = :driverId', {
        driverId: Number(actor.id),
      });
    }

    const inProgressRaw = await inProgressDrivers.getRawMany<{
      driverId: number;
    }>();
    const inProgressDriverIds = inProgressRaw.map((r) => Number(r.driverId));

    const assignedVehiclesQb = this.vehiclesRepository
      .createQueryBuilder('v')
      .leftJoin('v.owner', 'o')
      .leftJoin('v.assignedDriver', 'd')
      .where('d.id IS NOT NULL');

    if (roleScope === 'owner') {
      assignedVehiclesQb.andWhere('o.id = :ownerId', {
        ownerId: Number(actor.id),
      });
    } else if (roleScope === 'driver') {
      assignedVehiclesQb.andWhere('d.id = :driverId', {
        driverId: Number(actor.id),
      });
    }

    const assignedVehiclesRaw = await assignedVehiclesQb
      .select('COUNT(DISTINCT v.id)', 'count')
      .getRawOne<{ count: string }>();

    const assignedVehiclesCount = Number(assignedVehiclesRaw?.count ?? 0);

    let busyVehiclesCount = 0;
    if (inProgressDriverIds.length > 0) {
      const busyRaw = await assignedVehiclesQb
        .clone()
        .andWhere('d.id IN (:...driverIds)', { driverIds: inProgressDriverIds })
        .select('COUNT(DISTINCT v.id)', 'count')
        .getRawOne<{ count: string }>();

      busyVehiclesCount = Number(busyRaw?.count ?? 0);
    }

    const freeVehiclesCount = assignedVehiclesCount - busyVehiclesCount;

    // Top drivers by profit (finance_records.profit)
    const topDriversRaw = await this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .leftJoin('r.driver', 'd')
      .where('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
        from,
        to,
      });

    this.applyFinanceScope(topDriversRaw, actor, {
      financeAlias: 'fr',
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const topDrivers = await topDriversRaw
      .select('d.id', 'driverId')
      .addSelect('MAX(d.email)', 'email')
      .addSelect('MAX(d.firstName)', 'firstName')
      .addSelect('MAX(d.lastName)', 'lastName')
      .addSelect('SUM(fr.profit)', 'profit')
      .groupBy('d.id')
      .orderBy('profit', 'DESC')
      .limit(5)
      .getRawMany<{
        driverId: number;
        email: string;
        firstName: string | null;
        lastName: string | null;
        profit: string;
      }>();

    return {
      revenue: totalsRaw?.revenue ? Number(totalsRaw.revenue) : 0,
      profit: totalsRaw?.profit ? Number(totalsRaw.profit) : 0,
      pendingReceiptsCount: Number(pendingRaw?.count ?? 0),
      vehicles: {
        busyCount: busyVehiclesCount,
        freeCount: freeVehiclesCount,
      },
      topDrivers,
    };
  }

  async getReceiptsReport(actor: JwtPayloadType, query: any): Promise<any> {
    const range = query?.range ?? 'today';
    const groupBy = query?.groupBy ?? 'day';
    const status = query?.status ?? 'all';

    const resolveTimeRange = (): { from: Date; to: Date } => {
      const now = new Date();
      if (range === 'custom') {
        const from = query?.from ? new Date(query.from) : now;
        const to = query?.to ? new Date(query.to) : now;
        return { from, to };
      }
      if (range === 'month') {
        const from = new Date(now);
        from.setDate(1);
        from.setHours(0, 0, 0, 0);

        const to = new Date(from);
        to.setMonth(from.getMonth() + 1);
        to.setMilliseconds(-1);
        return { from, to };
      }

      const from = new Date(now);
      from.setHours(0, 0, 0, 0);

      const to = new Date(now);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    };

    const { from, to } = resolveTimeRange();

    const qb = this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoin('r.harvestArea', 'ha')
      .leftJoin('r.weighingStation', 'ws')
      .leftJoin('r.driver', 'd')
      .leftJoin('r.trip', 'trip');

    this.applyReceiptScope(qb, actor, {
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    qb.where('r.receipt_date >= :from AND r.receipt_date <= :to', {
      from,
      to,
    });

    if (status !== 'all') {
      qb.andWhere('r.status = :st', { st: status });
    }

    // Common metrics
    qb.addSelect('COUNT(DISTINCT r.id)', 'count');
    qb.addSelect('COALESCE(SUM(r.weight), 0)', 'sumWeight');
    qb.addSelect('COALESCE(SUM(r.amount), 0)', 'sumAmount');

    switch (groupBy) {
      case 'day': {
        qb.addSelect(
          "TO_CHAR(date_trunc('day', r.receipt_date), 'YYYY-MM-DD')",
          'group',
        );
        qb.groupBy("date_trunc('day', r.receipt_date)");
        qb.orderBy("date_trunc('day', r.receipt_date)", 'ASC');
        break;
      }
      case 'harvestArea': {
        qb.addSelect('ha.id', 'group').addSelect('ha.name', 'label');
        qb.groupBy('ha.id').addGroupBy('ha.name');
        qb.orderBy('count', 'DESC');
        break;
      }
      case 'weighingStation': {
        qb.addSelect('ws.id', 'group').addSelect('ws.name', 'label');
        qb.groupBy('ws.id').addGroupBy('ws.name');
        qb.orderBy('count', 'DESC');
        break;
      }
      case 'driver': {
        qb.addSelect('d.id', 'group').addSelect('d.email', 'label');
        qb.groupBy('d.id').addGroupBy('d.email');
        qb.orderBy('count', 'DESC');
        break;
      }
      case 'trip': {
        qb.addSelect('trip.id', 'group');
        qb.groupBy('trip.id');
        qb.orderBy('count', 'DESC');
        break;
      }
      default: {
        qb.addSelect(
          "TO_CHAR(date_trunc('day', r.receipt_date), 'YYYY-MM-DD')",
          'group',
        );
        qb.groupBy("date_trunc('day', r.receipt_date)");
        qb.orderBy("date_trunc('day', r.receipt_date)", 'ASC');
      }
    }

    const rows = await qb.getRawMany<{
      group: string;
      label?: string | null;
      count: string;
      sumWeight: string;
      sumAmount: string;
    }>();

    return {
      range,
      groupBy,
      status,
      data: rows.map((r) => ({
        group: r.group,
        label: r.label ?? null,
        count: Number(r.count ?? 0),
        sumWeight: Number(r.sumWeight ?? 0),
        sumAmount: Number(r.sumAmount ?? 0),
      })),
    };
  }

  async getFinanceReport(actor: JwtPayloadType, query: any): Promise<any> {
    const range = query?.range ?? 'today';
    const groupBy = query?.groupBy ?? 'day';

    const resolveTimeRange = (): { from: Date; to: Date } => {
      const now = new Date();
      if (range === 'custom') {
        const from = query?.from ? new Date(query.from) : now;
        const to = query?.to ? new Date(query.to) : now;
        return { from, to };
      }
      if (range === 'month') {
        const from = new Date(now);
        from.setDate(1);
        from.setHours(0, 0, 0, 0);

        const to = new Date(from);
        to.setMonth(from.getMonth() + 1);
        to.setMilliseconds(-1);
        return { from, to };
      }

      const from = new Date(now);
      from.setHours(0, 0, 0, 0);

      const to = new Date(now);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    };

    const { from, to } = resolveTimeRange();

    const qb = this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .leftJoin('r.weighingStation', 'ws')
      .leftJoin('r.driver', 'd')
      .leftJoin('r.trip', 'trip');

    this.applyFinanceScope(qb, actor, {
      financeAlias: 'fr',
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    qb.where('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
      from,
      to,
    });

    qb.addSelect('COUNT(DISTINCT r.id)', 'countReceipts');
    qb.addSelect('COALESCE(SUM(fr.revenue), 0)', 'revenueSum');
    qb.addSelect('COALESCE(SUM(fr.cost_driver), 0)', 'costDriverSum');
    qb.addSelect('COALESCE(SUM(fr.cost_harvest), 0)', 'costHarvestSum');
    qb.addSelect('COALESCE(SUM(fr.other_cost), 0)', 'otherCostSum');
    qb.addSelect('COALESCE(SUM(fr.profit), 0)', 'profitSum');

    switch (groupBy) {
      case 'day': {
        qb.addSelect(
          "TO_CHAR(date_trunc('day', fr.calculated_at), 'YYYY-MM-DD')",
          'group',
        );
        qb.groupBy("date_trunc('day', fr.calculated_at)");
        qb.orderBy("date_trunc('day', fr.calculated_at)", 'ASC');
        break;
      }
      case 'harvestArea': {
        qb.addSelect('ha.id', 'group').addSelect('ha.name', 'label');
        qb.groupBy('ha.id').addGroupBy('ha.name');
        qb.orderBy('profitSum', 'DESC');
        break;
      }
      case 'weighingStation': {
        qb.addSelect('ws.id', 'group').addSelect('ws.name', 'label');
        qb.groupBy('ws.id').addGroupBy('ws.name');
        qb.orderBy('profitSum', 'DESC');
        break;
      }
      case 'driver': {
        qb.addSelect('d.id', 'group').addSelect('d.email', 'label');
        qb.groupBy('d.id').addGroupBy('d.email');
        qb.orderBy('profitSum', 'DESC');
        break;
      }
      case 'trip': {
        qb.addSelect('trip.id', 'group');
        qb.groupBy('trip.id');
        qb.orderBy('profitSum', 'DESC');
        break;
      }
      default: {
        qb.addSelect(
          "TO_CHAR(date_trunc('day', fr.calculated_at), 'YYYY-MM-DD')",
          'group',
        );
        qb.groupBy("date_trunc('day', fr.calculated_at)");
        qb.orderBy("date_trunc('day', fr.calculated_at)", 'ASC');
      }
    }

    const rows = await qb.getRawMany<{
      group: string;
      label?: string | null;
      countReceipts: string;
      revenueSum: string;
      costDriverSum: string;
      costHarvestSum: string;
      otherCostSum: string;
      profitSum: string;
    }>();

    return {
      range,
      groupBy,
      data: rows.map((r) => ({
        group: r.group,
        label: r.label ?? null,
        countReceipts: Number(r.countReceipts ?? 0),
        revenueSum: Number(r.revenueSum ?? 0),
        costDriverSum: Number(r.costDriverSum ?? 0),
        costHarvestSum: Number(r.costHarvestSum ?? 0),
        otherCostSum: Number(r.otherCostSum ?? 0),
        profitSum: Number(r.profitSum ?? 0),
      })),
    };
  }

  async getTripsReport(actor: JwtPayloadType, query: any): Promise<any> {
    const range = query?.range ?? 'today';
    const groupBy = query?.groupBy ?? 'day';
    const status = query?.status;

    const resolveTimeRange = (): { from: Date; to: Date } => {
      const now = new Date();
      if (range === 'custom') {
        const from = query?.from ? new Date(query.from) : now;
        const to = query?.to ? new Date(query.to) : now;
        return { from, to };
      }
      if (range === 'month') {
        const from = new Date(now);
        from.setDate(1);
        from.setHours(0, 0, 0, 0);

        const to = new Date(from);
        to.setMonth(from.getMonth() + 1);
        to.setMilliseconds(-1);
        return { from, to };
      }

      const from = new Date(now);
      from.setHours(0, 0, 0, 0);

      const to = new Date(now);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    };

    const { from, to } = resolveTimeRange();

    const qb = this.tripsRepository
      .createQueryBuilder('t')
      .leftJoin('t.harvestArea', 'ha')
      .leftJoin('t.driver', 'd')
      .leftJoin('t.weighingStation', 'ws');

    this.applyTripScope(qb, actor, {
      tripAlias: 't',
      harvestAreaAlias: 'ha',
    });

    qb.where('t.created_at >= :from AND t.created_at <= :to', { from, to });

    if (status) {
      qb.andWhere('t.status = :st', { st: status });
    }

    qb.addSelect('COUNT(DISTINCT t.id)', 'countTrips');
    qb.addSelect('COALESCE(SUM(t.total_tons), 0)', 'sumTotalTons');

    switch (groupBy) {
      case 'day': {
        qb.addSelect(
          "TO_CHAR(date_trunc('day', t.created_at), 'YYYY-MM-DD')",
          'group',
        );
        qb.groupBy("date_trunc('day', t.created_at)");
        qb.orderBy("date_trunc('day', t.created_at)", 'ASC');
        break;
      }
      case 'status': {
        qb.addSelect('t.status', 'group');
        qb.groupBy('t.status');
        qb.orderBy('countTrips', 'DESC');
        break;
      }
      case 'driver': {
        qb.addSelect('d.id', 'group').addSelect('d.email', 'label');
        qb.groupBy('d.id').addGroupBy('d.email');
        qb.orderBy('countTrips', 'DESC');
        break;
      }
      case 'harvestArea': {
        qb.addSelect('ha.id', 'group').addSelect('ha.name', 'label');
        qb.groupBy('ha.id').addGroupBy('ha.name');
        qb.orderBy('countTrips', 'DESC');
        break;
      }
      default: {
        qb.addSelect(
          "TO_CHAR(date_trunc('day', t.created_at), 'YYYY-MM-DD')",
          'group',
        );
        qb.groupBy("date_trunc('day', t.created_at)");
        qb.orderBy("date_trunc('day', t.created_at)", 'ASC');
      }
    }

    const rows = await qb.getRawMany<{
      group: string;
      label?: string | null;
      countTrips: string;
      sumTotalTons: string;
    }>();

    return {
      range,
      groupBy,
      status: status ?? null,
      data: rows.map((r) => ({
        group: r.group,
        label: r.label ?? null,
        countTrips: Number(r.countTrips ?? 0),
        sumTotalTons: Number(r.sumTotalTons ?? 0),
      })),
    };
  }

  async getDriverMeDetail(actor: JwtPayloadType, query: any): Promise<any> {
    if (!this.opsAuthorizationService.isDriver(actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    return this.getDriverDetail(actor, Number(actor.id), query);
  }

  async getDriverDetail(
    actor: JwtPayloadType,
    driverId: number,
    query: any,
  ): Promise<any> {
    if (this.opsAuthorizationService.isDriver(actor)) {
      if (Number(actor.id) !== driverId) {
        throw new ForbiddenException({ error: 'forbidden' });
      }
    } else if (this.opsAuthorizationService.isOwner(actor)) {
      await this.opsAuthorizationService.assertOwnerManagesDriver(
        actor,
        driverId,
      );
    } else {
      // admin
    }

    const driver = await this.usersRepository.findOne({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException({ error: 'driverNotFound' });
    }

    const range = query?.range ?? 'today';
    const resolveTimeRange = (): { from: Date; to: Date } => {
      const now = new Date();
      if (range === 'custom') {
        const from = query?.from ? new Date(query.from) : now;
        const to = query?.to ? new Date(query.to) : now;
        return { from, to };
      }
      if (range === 'month') {
        const from = new Date(now);
        from.setDate(1);
        from.setHours(0, 0, 0, 0);

        const to = new Date(from);
        to.setMonth(from.getMonth() + 1);
        to.setMilliseconds(-1);
        return { from, to };
      }

      const from = new Date(now);
      from.setHours(0, 0, 0, 0);

      const to = new Date(now);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    };
    const { from, to } = resolveTimeRange();

    const currentTrip = await this.tripsRepository.findOne({
      where: {
        driver: { id: driverId } as any,
        status: TripStatusEnum.inProgress,
      },
      relations: ['harvestArea', 'weighingStation'],
    });

    const assignments = await this.driverHarvestAreasRepository.find({
      where: { driverId },
      relations: ['harvestArea'],
    });

    const assignedHarvestAreas = assignments.map((a) => a.harvestArea);

    const vehicle = await this.vehiclesRepository.findOne({
      where: { assignedDriver: { id: driverId } as any },
      relations: ['owner', 'assignedDriver'],
    });

    // Receipts summary in range for this driver
    const receiptsAgg = await this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoin('r.harvestArea', 'ha')
      .where('r.driver_id = :driverId', { driverId })
      .andWhere('r.receipt_date >= :from AND r.receipt_date <= :to', {
        from,
        to,
      })
      .andWhere('r.status IN (:...statuses)', {
        statuses: Object.values(ReceiptStatusEnum),
      })
      .select('COUNT(DISTINCT r.id)', 'count')
      .addSelect(
        `SUM(CASE WHEN r.status = '${ReceiptStatusEnum.pending}' THEN 1 ELSE 0 END)`,
        'pendingCount',
      )
      .addSelect(
        `SUM(CASE WHEN r.status = '${ReceiptStatusEnum.approved}' THEN 1 ELSE 0 END)`,
        'approvedCount',
      )
      .addSelect(
        `SUM(CASE WHEN r.status = '${ReceiptStatusEnum.rejected}' THEN 1 ELSE 0 END)`,
        'rejectedCount',
      )
      .addSelect('COALESCE(SUM(r.weight), 0)', 'sumWeight')
      .addSelect('COALESCE(SUM(r.amount), 0)', 'sumAmount')
      .getRawOne<{
        count: string;
        pendingCount: string;
        approvedCount: string;
        rejectedCount: string;
        sumWeight: string;
        sumAmount: string;
      }>();

    // Finance summary in range for this driver
    const financeAgg = await this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .where('r.driver_id = :driverId', { driverId })
      .andWhere('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
        from,
        to,
      })
      .select('COALESCE(SUM(fr.revenue), 0)', 'revenueSum')
      .addSelect('COALESCE(SUM(fr.cost_driver), 0)', 'costDriverSum')
      .addSelect('COALESCE(SUM(fr.cost_harvest), 0)', 'costHarvestSum')
      .addSelect('COALESCE(SUM(fr.other_cost), 0)', 'otherCostSum')
      .addSelect('COALESCE(SUM(fr.profit), 0)', 'profitSum')
      .getRawOne<{
        revenueSum: string;
        costDriverSum: string;
        costHarvestSum: string;
        otherCostSum: string;
        profitSum: string;
      }>();

    return {
      driver,
      currentTrip,
      vehicle: vehicle ?? null,
      assignedHarvestAreas,
      receiptsSummary: {
        count: Number(receiptsAgg?.count ?? 0),
        pendingCount: Number(receiptsAgg?.pendingCount ?? 0),
        approvedCount: Number(receiptsAgg?.approvedCount ?? 0),
        rejectedCount: Number(receiptsAgg?.rejectedCount ?? 0),
        sumWeight: Number(receiptsAgg?.sumWeight ?? 0),
        sumAmount: Number(receiptsAgg?.sumAmount ?? 0),
      },
      financeSummary: {
        revenueSum: Number(financeAgg?.revenueSum ?? 0),
        costDriverSum: Number(financeAgg?.costDriverSum ?? 0),
        costHarvestSum: Number(financeAgg?.costHarvestSum ?? 0),
        otherCostSum: Number(financeAgg?.otherCostSum ?? 0),
        profitSum: Number(financeAgg?.profitSum ?? 0),
      },
    };
  }

  async getWeighingStationDetail(
    actor: JwtPayloadType,
    weighingStationId: string,
    query: any,
  ): Promise<any> {
    await this.assertActorCanViewWeighingStation(actor, weighingStationId);

    const station = await this.weighingStationsRepository.findOne({
      where: { id: weighingStationId },
    });

    if (!station) {
      throw new NotFoundException({ error: 'weighingStationNotFound' });
    }

    const range = query?.range ?? 'today';
    const resolveTimeRange = (): { from: Date; to: Date } => {
      const now = new Date();
      if (range === 'custom') {
        const from = query?.from ? new Date(query.from) : now;
        const to = query?.to ? new Date(query.to) : now;
        return { from, to };
      }
      if (range === 'month') {
        const from = new Date(now);
        from.setDate(1);
        from.setHours(0, 0, 0, 0);

        const to = new Date(from);
        to.setMonth(from.getMonth() + 1);
        to.setMilliseconds(-1);
        return { from, to };
      }

      const from = new Date(now);
      from.setHours(0, 0, 0, 0);

      const to = new Date(now);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    };
    const { from, to } = resolveTimeRange();

    const receiptsAggRows = await this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoin('r.harvestArea', 'ha')
      .where('r.weighing_station_id = :stationId', {
        stationId: weighingStationId,
      })
      .andWhere('r.receipt_date >= :from AND r.receipt_date <= :to', {
        from,
        to,
      });

    this.applyReceiptScope(receiptsAggRows, actor, {
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const receiptsSummary = await receiptsAggRows
      .select('r.status', 'status')
      .addSelect('COUNT(DISTINCT r.id)', 'count')
      .addSelect('COALESCE(SUM(r.weight), 0)', 'sumWeight')
      .addSelect('COALESCE(SUM(r.amount), 0)', 'sumAmount')
      .groupBy('r.status')
      .getRawMany<{
        status: string;
        count: string;
        sumWeight: string;
        sumAmount: string;
      }>();

    const receiptsTotals = await this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoin('r.harvestArea', 'ha')
      .where('r.weighing_station_id = :stationId', {
        stationId: weighingStationId,
      })
      .andWhere('r.receipt_date >= :from AND r.receipt_date <= :to', {
        from,
        to,
      });

    this.applyReceiptScope(receiptsTotals, actor, {
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const receiptsTotalsRaw = await receiptsTotals
      .select('COUNT(DISTINCT r.id)', 'count')
      .addSelect('COALESCE(SUM(r.weight), 0)', 'sumWeight')
      .addSelect('COALESCE(SUM(r.amount), 0)', 'sumAmount')
      .getRawOne<{
        count: string;
        sumWeight: string;
        sumAmount: string;
      }>();

    const financeAgg = await this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .where('r.weighing_station_id = :stationId', {
        stationId: weighingStationId,
      })
      .andWhere('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
        from,
        to,
      });

    this.applyFinanceScope(financeAgg, actor, {
      financeAlias: 'fr',
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const financeAggRaw = await financeAgg
      .select('COALESCE(SUM(fr.revenue), 0)', 'revenueSum')
      .addSelect('COALESCE(SUM(fr.cost_driver), 0)', 'costDriverSum')
      .addSelect('COALESCE(SUM(fr.cost_harvest), 0)', 'costHarvestSum')
      .addSelect('COALESCE(SUM(fr.other_cost), 0)', 'otherCostSum')
      .addSelect('COALESCE(SUM(fr.profit), 0)', 'profitSum')
      .getRawOne<{
        revenueSum: string;
        costDriverSum: string;
        costHarvestSum: string;
        otherCostSum: string;
        profitSum: string;
      }>();

    const currentTripsCountQb = this.tripsRepository
      .createQueryBuilder('t')
      .leftJoin('t.harvestArea', 'ha')
      .where('t.status = :st', { st: TripStatusEnum.inProgress })
      .andWhere('t.weighing_station_id = :stationId', {
        stationId: weighingStationId,
      });

    this.applyTripScope(currentTripsCountQb, actor, {
      tripAlias: 't',
      harvestAreaAlias: 'ha',
    });

    const currentTripsCountRaw = await currentTripsCountQb
      .select('COUNT(DISTINCT t.id)', 'count')
      .getRawOne<{ count: string }>();

    const byStatus = receiptsSummary.reduce(
      (acc, row) => {
        acc[row.status] = {
          count: Number(row.count ?? 0),
          sumWeight: Number(row.sumWeight ?? 0),
          sumAmount: Number(row.sumAmount ?? 0),
        };
        return acc;
      },
      {} as Record<
        string,
        { count: number; sumWeight: number; sumAmount: number }
      >,
    );

    return {
      station,
      currentTripsCount: Number(currentTripsCountRaw?.count ?? 0),
      receiptsSummary: {
        count: Number(receiptsTotalsRaw?.count ?? 0),
        sumWeight: Number(receiptsTotalsRaw?.sumWeight ?? 0),
        sumAmount: Number(receiptsTotalsRaw?.sumAmount ?? 0),
        byStatus,
      },
      financeSummary: {
        revenueSum: Number(financeAggRaw?.revenueSum ?? 0),
        costDriverSum: Number(financeAggRaw?.costDriverSum ?? 0),
        costHarvestSum: Number(financeAggRaw?.costHarvestSum ?? 0),
        otherCostSum: Number(financeAggRaw?.otherCostSum ?? 0),
        profitSum: Number(financeAggRaw?.profitSum ?? 0),
      },
    };
  }

  async getHarvestAreaDetail(
    actor: JwtPayloadType,
    harvestAreaId: string,
    query: any,
  ): Promise<any> {
    await this.assertActorCanViewHarvestArea(actor, harvestAreaId);

    const area = await this.harvestAreasRepository.findOne({
      where: { id: harvestAreaId },
    });

    if (!area) {
      throw new NotFoundException({ error: 'harvestAreaNotFound' });
    }

    const range = query?.range ?? 'today';
    const resolveTimeRange = (): { from: Date; to: Date } => {
      const now = new Date();
      if (range === 'custom') {
        const from = query?.from ? new Date(query.from) : now;
        const to = query?.to ? new Date(query.to) : now;
        return { from, to };
      }
      if (range === 'month') {
        const from = new Date(now);
        from.setDate(1);
        from.setHours(0, 0, 0, 0);

        const to = new Date(from);
        to.setMonth(from.getMonth() + 1);
        to.setMilliseconds(-1);
        return { from, to };
      }

      const from = new Date(now);
      from.setHours(0, 0, 0, 0);

      const to = new Date(now);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    };
    const { from, to } = resolveTimeRange();

    // Receipts summary (by status + totals) for this harvest area
    const receiptsAggRows = this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoin('r.harvestArea', 'ha')
      .where('r.harvest_area_id = :areaId', { areaId: harvestAreaId })
      .andWhere('r.receipt_date >= :from AND r.receipt_date <= :to', {
        from,
        to,
      });

    this.applyReceiptScope(receiptsAggRows, actor, {
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const receiptsByStatus = await receiptsAggRows
      .select('r.status', 'status')
      .addSelect('COUNT(DISTINCT r.id)', 'count')
      .addSelect('COALESCE(SUM(r.weight), 0)', 'sumWeight')
      .addSelect('COALESCE(SUM(r.amount), 0)', 'sumAmount')
      .groupBy('r.status')
      .getRawMany<{
        status: string;
        count: string;
        sumWeight: string;
        sumAmount: string;
      }>();

    const receiptsTotalsQb = this.receiptsRepository
      .createQueryBuilder('r')
      .leftJoin('r.harvestArea', 'ha')
      .where('r.harvest_area_id = :areaId', { areaId: harvestAreaId })
      .andWhere('r.receipt_date >= :from AND r.receipt_date <= :to', {
        from,
        to,
      });

    this.applyReceiptScope(receiptsTotalsQb, actor, {
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const receiptsTotalsRaw = await receiptsTotalsQb
      .select('COUNT(DISTINCT r.id)', 'count')
      .addSelect('COALESCE(SUM(r.weight), 0)', 'sumWeight')
      .addSelect('COALESCE(SUM(r.amount), 0)', 'sumAmount')
      .getRawOne<{
        count: string;
        sumWeight: string;
        sumAmount: string;
      }>();

    const receiptsByStatusMap = receiptsByStatus.reduce(
      (acc, row) => {
        acc[row.status] = {
          count: Number(row.count ?? 0),
          sumWeight: Number(row.sumWeight ?? 0),
          sumAmount: Number(row.sumAmount ?? 0),
        };
        return acc;
      },
      {} as Record<
        string,
        { count: number; sumWeight: number; sumAmount: number }
      >,
    );

    // Finance summary for this harvest area
    const financeAggQb = this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .where('r.harvest_area_id = :areaId', { areaId: harvestAreaId })
      .andWhere('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
        from,
        to,
      });

    this.applyFinanceScope(financeAggQb, actor, {
      financeAlias: 'fr',
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const financeAggRaw = await financeAggQb
      .select('COALESCE(SUM(fr.revenue), 0)', 'revenueSum')
      .addSelect('COALESCE(SUM(fr.cost_driver), 0)', 'costDriverSum')
      .addSelect('COALESCE(SUM(fr.cost_harvest), 0)', 'costHarvestSum')
      .addSelect('COALESCE(SUM(fr.other_cost), 0)', 'otherCostSum')
      .addSelect('COALESCE(SUM(fr.profit), 0)', 'profitSum')
      .getRawOne<{
        revenueSum: string;
        costDriverSum: string;
        costHarvestSum: string;
        otherCostSum: string;
        profitSum: string;
      }>();

    const currentTripsCountQb = this.tripsRepository
      .createQueryBuilder('t')
      .leftJoin('t.harvestArea', 'ha')
      .where('t.status = :st', { st: TripStatusEnum.inProgress })
      .andWhere('t.harvest_area_id = :areaId', { areaId: harvestAreaId });

    this.applyTripScope(currentTripsCountQb, actor, {
      tripAlias: 't',
      harvestAreaAlias: 'ha',
    });

    const currentTripsCountRaw = await currentTripsCountQb
      .select('COUNT(DISTINCT t.id)', 'count')
      .getRawOne<{ count: string }>();

    return {
      area,
      currentTripsCount: Number(currentTripsCountRaw?.count ?? 0),
      receiptsSummary: {
        count: Number(receiptsTotalsRaw?.count ?? 0),
        sumWeight: Number(receiptsTotalsRaw?.sumWeight ?? 0),
        sumAmount: Number(receiptsTotalsRaw?.sumAmount ?? 0),
        byStatus: receiptsByStatusMap,
      },
      financeSummary: {
        revenueSum: Number(financeAggRaw?.revenueSum ?? 0),
        costDriverSum: Number(financeAggRaw?.costDriverSum ?? 0),
        costHarvestSum: Number(financeAggRaw?.costHarvestSum ?? 0),
        otherCostSum: Number(financeAggRaw?.otherCostSum ?? 0),
        profitSum: Number(financeAggRaw?.profitSum ?? 0),
      },
    };
  }
}
