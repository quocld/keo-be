import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from '../ops/infrastructure/persistence/relational/entities/notification.entity';
import { ExpoPushTokenService } from './presentation/services/expo-push-token.service';
import { ExpoPushController } from './presentation/controllers/expo-push.controller';
import { NotificationInboxController } from './presentation/controllers/notification-inbox.controller';
import { UserExpoPushDeviceEntity } from './infrastructure/persistence/relational/entities/user-expo-push-device.entity';
import { ExpoPushQueue } from './infrastructure/queues/expo-push.queue';
import { NotificationsService } from './presentation/services/notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserExpoPushDeviceEntity, NotificationEntity]),
  ],
  controllers: [ExpoPushController, NotificationInboxController],
  providers: [ExpoPushTokenService, ExpoPushQueue, NotificationsService],
  exports: [ExpoPushTokenService, NotificationsService],
})
export class NotificationsModule {}
