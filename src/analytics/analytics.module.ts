import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpsAuthorizationService } from '../ops/presentation/services/ops-authorization.service';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { HarvestAreaEntity } from '../ops/infrastructure/persistence/relational/entities/harvest-area.entity';
import { DriverHarvestAreaEntity } from '../ops/infrastructure/persistence/relational/entities/driver-harvest-area.entity';
import { WeighingStationEntity } from '../ops/infrastructure/persistence/relational/entities/weighing-station.entity';
import { TripEntity } from '../ops/infrastructure/persistence/relational/entities/trip.entity';
import { ReceiptEntity } from '../ops/infrastructure/persistence/relational/entities/receipt.entity';
import { FinanceRecordEntity } from '../ops/infrastructure/persistence/relational/entities/finance-record.entity';
import { VehicleEntity } from '../ops/infrastructure/persistence/relational/entities/vehicle.entity';
import { AnalyticsService } from './presentation/services/analytics.service';
import { DashboardController } from './presentation/controllers/dashboard.controller';
import { ReportsController } from './presentation/controllers/reports.controller';
import { DetailsController } from './presentation/controllers/details.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      HarvestAreaEntity,
      DriverHarvestAreaEntity,
      WeighingStationEntity,
      TripEntity,
      ReceiptEntity,
      FinanceRecordEntity,
      VehicleEntity,
    ]),
  ],
  controllers: [DashboardController, ReportsController, DetailsController],
  providers: [OpsAuthorizationService, AnalyticsService],
})
export class AnalyticsModule {}
