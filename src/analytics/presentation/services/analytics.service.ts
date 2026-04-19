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
import { HarvestAreaCostEntryEntity } from '../../../ops/infrastructure/persistence/relational/entities/harvest-area-cost-entry.entity';
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
    @InjectRepository(HarvestAreaCostEntryEntity)
    private readonly harvestAreaCostEntriesRepository: Repository<HarvestAreaCostEntryEntity>,
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

    const currentRevenue = totalsRaw?.revenue ? Number(totalsRaw.revenue) : 0;
    const currentProfit = totalsRaw?.profit ? Number(totalsRaw.profit) : 0;

    // Total Weight (sum approved receipt weight) over the same finance scope/time range.
    const totalWeightRaw = this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .leftJoin('r.driver', 'd')
      .where('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
        from,
        to,
      });

    this.applyFinanceScope(totalWeightRaw, actor, {
      financeAlias: 'fr',
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const totalWeightResult = await totalWeightRaw
      .select('COALESCE(SUM(r.weight), 0)', 'totalWeight')
      .getRawOne<{ totalWeight: string }>();

    const totalWeight = Number(totalWeightResult?.totalWeight ?? 0);

    const getInclusiveDays = (fromDate: Date, toDate: Date): number => {
      const ms = toDate.getTime() - fromDate.getTime();
      // Inclusive day count for human-friendly averages.
      return Math.max(1, Math.ceil(ms / 86400000) + 1);
    };

    const daysInRange =
      range === 'today'
        ? 1
        : range === 'month'
          ? (() => {
              const d = new Date(from);
              const year = d.getFullYear();
              const month = d.getMonth();
              // Day 0 of next month = last day of current month.
              return new Date(year, month + 1, 0).getDate();
            })()
          : getInclusiveDays(from, to);

    const marginPercent =
      currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;

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

    // Revenue/Profit trend vs previous period with the same duration.
    const durationMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(from.getTime() - durationMs - 1);

    const prevFinanceTotals = await this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .leftJoin('r.driver', 'd')
      .where('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
        from: prevFrom,
        to: prevTo,
      });

    this.applyFinanceScope(prevFinanceTotals, actor, {
      financeAlias: 'fr',
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const prevTotalsRaw = await prevFinanceTotals
      .select('COALESCE(SUM(fr.revenue), 0)', 'revenue')
      .addSelect('COALESCE(SUM(fr.profit), 0)', 'profit')
      .getRawOne<{ revenue: string; profit: string }>();

    const prevRevenue = prevTotalsRaw?.revenue
      ? Number(prevTotalsRaw.revenue)
      : 0;
    const prevProfit = prevTotalsRaw?.profit ? Number(prevTotalsRaw.profit) : 0;

    const revenueTrendPercent =
      prevRevenue > 0
        ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
        : 0;
    const profitTrendPercent =
      prevProfit > 0 ? ((currentProfit - prevProfit) / prevProfit) * 100 : 0;

    // Transport growth: compare approved receipt weight in last 30 days vs previous 30 days.
    const now = new Date();
    const current30From = new Date(now);
    current30From.setDate(now.getDate() - 30);
    const current30To = now;

    const previous30From = new Date(current30From);
    previous30From.setDate(current30From.getDate() - 30);
    const previous30To = new Date(current30From.getTime() - 1);

    const current30WeightQb = this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .leftJoin('r.driver', 'd')
      .where('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
        from: current30From,
        to: current30To,
      });

    this.applyFinanceScope(current30WeightQb, actor, {
      financeAlias: 'fr',
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const current30WeightRaw = await current30WeightQb
      .select('COALESCE(SUM(r.weight), 0)', 'totalWeight')
      .getRawOne<{ totalWeight: string }>();

    const previous30WeightQb = this.financeRecordsRepository
      .createQueryBuilder('fr')
      .leftJoin('fr.receipt', 'r')
      .leftJoin('r.harvestArea', 'ha')
      .leftJoin('r.driver', 'd')
      .where('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
        from: previous30From,
        to: previous30To,
      });

    this.applyFinanceScope(previous30WeightQb, actor, {
      financeAlias: 'fr',
      receiptAlias: 'r',
      harvestAreaAlias: 'ha',
    });

    const previous30WeightRaw = await previous30WeightQb
      .select('COALESCE(SUM(r.weight), 0)', 'totalWeight')
      .getRawOne<{ totalWeight: string }>();

    const current30Weight = Number(current30WeightRaw?.totalWeight ?? 0);
    const previous30Weight = Number(previous30WeightRaw?.totalWeight ?? 0);

    const transportGrowthPercent30d =
      previous30Weight > 0
        ? ((current30Weight - previous30Weight) / previous30Weight) * 100
        : current30Weight > 0
          ? 100
          : 0;

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

    // Fleet status counts (active/onRoad/maintenance/idle) for owner dashboards.
    const vehiclesStatusQb = this.vehiclesRepository
      .createQueryBuilder('v')
      .leftJoin('v.owner', 'o')
      .leftJoin('v.assignedDriver', 'd');

    if (roleScope === 'owner') {
      vehiclesStatusQb.andWhere('o.id = :ownerId', {
        ownerId: Number(actor.id),
      });
    } else if (roleScope === 'driver') {
      vehiclesStatusQb.andWhere('d.id = :driverId', {
        driverId: Number(actor.id),
      });
    }

    const vehicleStatusRows = await vehiclesStatusQb
      .select('v.status', 'status')
      .addSelect('COUNT(DISTINCT v.id)', 'count')
      .groupBy('v.status')
      .getRawMany<{ status: string; count: string }>();

    const vehicleStatusCounts = vehicleStatusRows.reduce(
      (acc, row) => {
        acc[row.status] = Number(row.count ?? 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    const vehiclesActiveCount = vehicleStatusCounts['active'] ?? 0;
    const maintenanceCount = vehicleStatusCounts['maintenance'] ?? 0;
    const idleCount = vehicleStatusCounts['idle'] ?? 0;
    const vehiclesTotalCount = vehicleStatusRows.reduce(
      (sum, row) => sum + Number(row.count ?? 0),
      0,
    );

    let onRoadCount = 0;
    if (inProgressDriverIds.length > 0) {
      const onRoadQb = this.vehiclesRepository
        .createQueryBuilder('v')
        .leftJoin('v.owner', 'o')
        .leftJoin('v.assignedDriver', 'd')
        .where('v.status = :activeStatus', { activeStatus: 'active' })
        .andWhere('d.id IN (:...driverIds)', { driverIds: inProgressDriverIds })
        .select('COUNT(DISTINCT v.id)', 'count');

      if (roleScope === 'owner') {
        onRoadQb.andWhere('o.id = :ownerId', {
          ownerId: Number(actor.id),
        });
      } else if (roleScope === 'driver') {
        onRoadQb.andWhere('d.id = :driverId', {
          driverId: Number(actor.id),
        });
      }

      const onRoadRaw = await onRoadQb.getRawOne<{ count: string }>();
      onRoadCount = Number(onRoadRaw?.count ?? 0);
    }

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
      .addSelect('SUM(fr.revenue)', 'revenue')
      .addSelect('COUNT(fr.id)', 'deliveries')
      .groupBy('d.id')
      .orderBy('profit', 'DESC')
      .limit(5)
      .getRawMany<{
        driverId: number;
        email: string;
        firstName: string | null;
        lastName: string | null;
        profit: string;
        revenue: string;
        deliveries: string;
      }>();

    let operatingCostSumTotal = 0;
    let harvestAreaSummaries:
      | {
          harvestAreaId: string;
          name: string | null;
          revenue: number;
          profitFromReceipts: number;
          operatingCost: number;
          profitAfterOperatingCosts: number;
          marginPercent: number;
        }[]
      | undefined;

    if (roleScope === 'owner') {
      const ownerId = Number(actor.id);
      const costTotalRaw = await this.harvestAreaCostEntriesRepository
        .createQueryBuilder('e')
        .innerJoin('e.harvestArea', 'ha')
        .where('ha.owner_id = :ownerId', { ownerId })
        .andWhere('e.incurred_at >= :from AND e.incurred_at <= :to', {
          from,
          to,
        })
        .select('COALESCE(SUM(e.amount), 0)', 's')
        .getRawOne<{ s: string }>();
      operatingCostSumTotal = Number(costTotalRaw?.s ?? 0);

      const finByHa = await this.financeRecordsRepository
        .createQueryBuilder('fr')
        .innerJoin('fr.receipt', 'r')
        .innerJoin('r.harvestArea', 'ha')
        .where('fr.calculated_at >= :from AND fr.calculated_at <= :to', {
          from,
          to,
        })
        .andWhere('ha.owner_id = :ownerId', { ownerId })
        .select('ha.id', 'harvestAreaId')
        .addSelect('ha.name', 'harvestAreaName')
        .addSelect('COALESCE(SUM(fr.revenue), 0)', 'revenueSum')
        .addSelect('COALESCE(SUM(fr.profit), 0)', 'profitSum')
        .groupBy('ha.id')
        .addGroupBy('ha.name')
        .getRawMany<{
          harvestAreaId: string;
          harvestAreaName: string;
          revenueSum: string;
          profitSum: string;
        }>();

      const costByHa = await this.harvestAreaCostEntriesRepository
        .createQueryBuilder('e')
        .innerJoin('e.harvestArea', 'ha')
        .where('ha.owner_id = :ownerId', { ownerId })
        .andWhere('e.incurred_at >= :from AND e.incurred_at <= :to', {
          from,
          to,
        })
        .select('ha.id', 'harvestAreaId')
        .addSelect('ha.name', 'harvestAreaName')
        .addSelect('COALESCE(SUM(e.amount), 0)', 'operatingCostSum')
        .groupBy('ha.id')
        .addGroupBy('ha.name')
        .getRawMany<{
          harvestAreaId: string;
          harvestAreaName: string;
          operatingCostSum: string;
        }>();

      const costMap = new Map(
        costByHa.map((r) => [
          r.harvestAreaId,
          {
            cost: Number(r.operatingCostSum ?? 0),
            name: r.harvestAreaName,
          },
        ]),
      );
      const finIds = new Set(finByHa.map((r) => r.harvestAreaId));
      harvestAreaSummaries = finByHa.map((row) => {
        const opCost = costMap.get(row.harvestAreaId)?.cost ?? 0;
        const rev = Number(row.revenueSum ?? 0);
        const prof = Number(row.profitSum ?? 0);
        const after = prof - opCost;
        return {
          harvestAreaId: row.harvestAreaId,
          name: row.harvestAreaName,
          revenue: rev,
          profitFromReceipts: prof,
          operatingCost: opCost,
          profitAfterOperatingCosts: after,
          marginPercent: rev > 0 ? (after / rev) * 100 : 0,
        };
      });
      for (const c of costByHa) {
        if (!finIds.has(c.harvestAreaId)) {
          const opCost = Number(c.operatingCostSum ?? 0);
          harvestAreaSummaries.push({
            harvestAreaId: c.harvestAreaId,
            name: c.harvestAreaName,
            revenue: 0,
            profitFromReceipts: 0,
            operatingCost: opCost,
            profitAfterOperatingCosts: -opCost,
            marginPercent: 0,
          });
        }
      }
    }

    const profitAfterOperatingGlobal =
      roleScope === 'owner'
        ? currentProfit - operatingCostSumTotal
        : currentProfit;

    return {
      revenue: currentRevenue,
      profit: currentProfit,
      totalWeight,
      dailyAvgWeight: totalWeight / daysInRange,
      marginPercent,
      revenueTrendPercent,
      profitTrendPercent,
      transportGrowthPercent30d,
      pendingReceiptsCount: Number(pendingRaw?.count ?? 0),
      vehicles: {
        busyCount: busyVehiclesCount,
        freeCount: freeVehiclesCount,
      },
      fleetStatus: {
        vehiclesActiveCount,
        onRoadCount,
        maintenanceCount,
        idleCount,
        vehiclesTotalCount,
      },
      topDrivers: topDrivers.map((d) => ({
        driverId: d.driverId,
        email: d.email,
        firstName: d.firstName,
        lastName: d.lastName,
        profit: Number(d.profit ?? 0),
        revenue: Number(d.revenue ?? 0),
        deliveries: Number(d.deliveries ?? 0),
      })),
      ...(roleScope === 'owner'
        ? {
            revenueRaw: totalsRaw?.revenue ?? '0',
            profitRaw: totalsRaw?.profit ?? '0',
            operatingCostSumTotal,
            profitAfterOperatingCosts: profitAfterOperatingGlobal,
            marginPercentAfterOperating:
              currentRevenue > 0
                ? (profitAfterOperatingGlobal / currentRevenue) * 100
                : 0,
            harvestAreaSummaries,
            marginPercentNote:
              'marginPercent uses receipt-level profit only; use marginPercentAfterOperating and harvestAreaSummaries for per-area operating costs.',
            aggregationNotes: {
              financeFilteredBy: 'calculated_at',
              pendingReceiptsFilteredBy: 'submitted_at',
              operatingCostsFilteredBy: 'incurred_at',
            },
          }
        : {}),
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

    qb.select('COUNT(DISTINCT r.id)', 'countReceipts');
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

    // For day-grouped reports, merge in operating costs from harvest_area_cost_entries.
    // Driver scope does not see area-level operating costs.
    const operatingCostByDay = new Map<string, number>();
    const roleScope = this.resolveRoleScope(actor);
    if (groupBy === 'day' && roleScope !== 'driver') {
      const opQb = this.harvestAreaCostEntriesRepository
        .createQueryBuilder('e')
        .innerJoin('e.harvestArea', 'ha')
        .where('e.incurred_at >= :from AND e.incurred_at <= :to', { from, to })
        .select(
          "TO_CHAR(date_trunc('day', e.incurred_at), 'YYYY-MM-DD')",
          'day',
        )
        .addSelect('COALESCE(SUM(e.amount), 0)', 'opSum')
        .groupBy("date_trunc('day', e.incurred_at)");

      if (roleScope === 'owner') {
        opQb.andWhere('ha.owner_id = :ownerId', {
          ownerId: Number(actor.id),
        });
      }

      const opRows = await opQb.getRawMany<{ day: string; opSum: string }>();
      for (const row of opRows) {
        operatingCostByDay.set(row.day, Number(row.opSum ?? 0));
      }
    }

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
        operatingCostSum: operatingCostByDay.get(r.group) ?? 0,
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

    const operatingCostRaw = await this.harvestAreaCostEntriesRepository
      .createQueryBuilder('e')
      .where('e.harvest_area_id = :areaId', { areaId: harvestAreaId })
      .andWhere('e.incurred_at >= :from AND e.incurred_at <= :to', {
        from,
        to,
      })
      .select('COALESCE(SUM(e.amount), 0)', 'operatingCostSum')
      .getRawOne<{ operatingCostSum: string }>();

    const operatingCostSum = Number(operatingCostRaw?.operatingCostSum ?? 0);
    const profitSum = Number(financeAggRaw?.profitSum ?? 0);
    const revenueSum = Number(financeAggRaw?.revenueSum ?? 0);
    const profitAfterOperatingCosts = profitSum - operatingCostSum;

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
        revenueSum,
        costDriverSum: Number(financeAggRaw?.costDriverSum ?? 0),
        costHarvestSum: Number(financeAggRaw?.costHarvestSum ?? 0),
        otherCostSum: Number(financeAggRaw?.otherCostSum ?? 0),
        profitSum,
        operatingCostSum,
        profitAfterOperatingCosts,
        marginPercentAfterOperating:
          revenueSum > 0 ? (profitAfterOperatingCosts / revenueSum) * 100 : 0,
      },
      aggregationNotes: {
        receiptsFilteredBy: 'receipt_date',
        financeFilteredBy: 'calculated_at',
        operatingCostsFilteredBy: 'incurred_at',
      },
    };
  }
}
