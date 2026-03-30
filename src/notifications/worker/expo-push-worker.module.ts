import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmConfigService } from '../../database/typeorm-config.service';
import databaseConfig from '../../database/config/database.config';
import appConfig from '../../config/app.config';
import { NotificationEntity } from '../../ops/infrastructure/persistence/relational/entities/notification.entity';
import { NotificationDeliveryEntity } from '../infrastructure/persistence/relational/entities/notification-delivery.entity';
import { UserExpoPushDeviceEntity } from '../infrastructure/persistence/relational/entities/user-expo-push-device.entity';
import { ExpoPushDeliveryService } from '../services/expo-push-delivery.service';
import { ExpoPushWorker } from './expo-push.worker';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options: DataSourceOptions) => {
        return new DataSource(options).initialize();
      },
    }),
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationDeliveryEntity,
      UserExpoPushDeviceEntity,
    ]),
  ],
  providers: [ExpoPushDeliveryService, ExpoPushWorker],
})
export class ExpoPushWorkerModule {}
