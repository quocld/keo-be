import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { HarvestAreaEntity } from './infrastructure/persistence/relational/entities/harvest-area.entity';
import { DriverHarvestAreaEntity } from './infrastructure/persistence/relational/entities/driver-harvest-area.entity';
import { DriverProfileEntity } from './infrastructure/persistence/relational/entities/driver-profile.entity';
import { VehicleEntity } from './infrastructure/persistence/relational/entities/vehicle.entity';
import { VehicleExpenseEntity } from './infrastructure/persistence/relational/entities/vehicle-expense.entity';
import { WeighingStationEntity } from './infrastructure/persistence/relational/entities/weighing-station.entity';
import { ReceiptEntity } from './infrastructure/persistence/relational/entities/receipt.entity';
import { ReceiptImageEntity } from './infrastructure/persistence/relational/entities/receipt-image.entity';
import { FinanceRecordEntity } from './infrastructure/persistence/relational/entities/finance-record.entity';
import { TripEntity } from './infrastructure/persistence/relational/entities/trip.entity';
import { DriverLocationEntity } from './infrastructure/persistence/relational/entities/driver-location.entity';
import { VehicleLocationEntity } from './infrastructure/persistence/relational/entities/vehicle-location.entity';
import { HarvestAreasController } from './presentation/controllers/harvest-areas.controller';
import { WeighingStationsController } from './presentation/controllers/weighing-stations.controller';
import { ReceiptsController } from './presentation/controllers/receipts.controller';
import { TripsController } from './presentation/controllers/trips.controller';
import { DriverLocationHistoryController } from './presentation/controllers/driver-location-history.controller';
import { DriverLocationsController } from './presentation/controllers/driver-locations.controller';
import { TripLocationsController } from './presentation/controllers/trip-locations.controller';
import { OwnerDriverHarvestAreasController } from './presentation/controllers/owner-driver-harvest-areas.controller';
import { OwnerDriverVehicleController } from './presentation/controllers/owner-driver-vehicle.controller';
import { OwnerDriverLocationsController } from './presentation/controllers/owner-driver-locations.controller';
import { VehicleExpensesController } from './presentation/controllers/vehicle-expenses.controller';
import { VehiclesController } from './presentation/controllers/vehicles.controller';
import { HarvestAreasService } from './presentation/services/harvest-areas.service';
import { OwnerDriverHarvestAreasService } from './presentation/services/owner-driver-harvest-areas.service';
import { OwnerDriverVehicleService } from './presentation/services/owner-driver-vehicle.service';
import { OwnerDriverLocationsService } from './presentation/services/owner-driver-locations.service';
import { VehicleExpensesService } from './presentation/services/vehicle-expenses.service';
import { VehiclesService } from './presentation/services/vehicles.service';
import { WeighingStationsService } from './presentation/services/weighing-stations.service';
import { ReceiptsService } from './presentation/services/receipts.service';
import { TripsService } from './presentation/services/trips.service';
import { OpsAuthorizationService } from './presentation/services/ops-authorization.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocationCacheService } from './presentation/services/location-cache.service';
import { DriverLocationsService } from './presentation/services/driver-locations.service';
import { TripLocationsService } from './presentation/services/trip-locations.service';

@Module({
  imports: [
    FilesModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      HarvestAreaEntity,
      DriverHarvestAreaEntity,
      DriverProfileEntity,
      VehicleEntity,
      VehicleExpenseEntity,
      WeighingStationEntity,
      ReceiptEntity,
      ReceiptImageEntity,
      FinanceRecordEntity,
      TripEntity,
      DriverLocationEntity,
      VehicleLocationEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    HarvestAreasController,
    VehicleExpensesController,
    VehiclesController,
    WeighingStationsController,
    ReceiptsController,
    TripsController,
    DriverLocationsController,
    DriverLocationHistoryController,
    TripLocationsController,
    OwnerDriverHarvestAreasController,
    OwnerDriverVehicleController,
    OwnerDriverLocationsController,
  ],
  providers: [
    OpsAuthorizationService,
    LocationCacheService,
    HarvestAreasService,
    WeighingStationsService,
    OwnerDriverHarvestAreasService,
    OwnerDriverVehicleService,
    OwnerDriverLocationsService,
    VehicleExpensesService,
    VehiclesService,
    ReceiptsService,
    TripsService,
    DriverLocationsService,
    TripLocationsService,
  ],
})
export class OpsModule {}
