import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { HarvestAreaEntity } from './infrastructure/persistence/relational/entities/harvest-area.entity';
import { DriverHarvestAreaEntity } from './infrastructure/persistence/relational/entities/driver-harvest-area.entity';
import { WeighingStationEntity } from './infrastructure/persistence/relational/entities/weighing-station.entity';
import { ReceiptEntity } from './infrastructure/persistence/relational/entities/receipt.entity';
import { ReceiptImageEntity } from './infrastructure/persistence/relational/entities/receipt-image.entity';
import { FinanceRecordEntity } from './infrastructure/persistence/relational/entities/finance-record.entity';
import { TripEntity } from './infrastructure/persistence/relational/entities/trip.entity';
import { HarvestAreasController } from './presentation/controllers/harvest-areas.controller';
import { WeighingStationsController } from './presentation/controllers/weighing-stations.controller';
import { ReceiptsController } from './presentation/controllers/receipts.controller';
import { TripsController } from './presentation/controllers/trips.controller';
import { OwnerDriverHarvestAreasController } from './presentation/controllers/owner-driver-harvest-areas.controller';
import { HarvestAreasService } from './presentation/services/harvest-areas.service';
import { OwnerDriverHarvestAreasService } from './presentation/services/owner-driver-harvest-areas.service';
import { WeighingStationsService } from './presentation/services/weighing-stations.service';
import { ReceiptsService } from './presentation/services/receipts.service';
import { TripsService } from './presentation/services/trips.service';
import { OpsAuthorizationService } from './presentation/services/ops-authorization.service';

@Module({
  imports: [
    FilesModule,
    TypeOrmModule.forFeature([
      HarvestAreaEntity,
      DriverHarvestAreaEntity,
      WeighingStationEntity,
      ReceiptEntity,
      ReceiptImageEntity,
      FinanceRecordEntity,
      TripEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    HarvestAreasController,
    WeighingStationsController,
    ReceiptsController,
    TripsController,
    OwnerDriverHarvestAreasController,
  ],
  providers: [
    OpsAuthorizationService,
    HarvestAreasService,
    WeighingStationsService,
    OwnerDriverHarvestAreasService,
    ReceiptsService,
    TripsService,
  ],
})
export class OpsModule {}
