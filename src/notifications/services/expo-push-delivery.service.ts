import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Expo } from 'expo-server-sdk';
import { NotificationEntity } from '../../ops/infrastructure/persistence/relational/entities/notification.entity';
import { NotificationDeliveryEntity } from '../infrastructure/persistence/relational/entities/notification-delivery.entity';
import { UserExpoPushDeviceEntity } from '../infrastructure/persistence/relational/entities/user-expo-push-device.entity';
import {
  expoPushWorkerLog,
  type ExpoPushSendJobData,
} from '../worker/expo-push-job.types';

const expoTokenErrorCodesToDisable = new Set([
  'DeviceNotRegistered',
  'InvalidCredentials',
  'MessageTooBig',
]);

@Injectable()
export class ExpoPushDeliveryService {
  private readonly logger = new Logger(ExpoPushDeliveryService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(UserExpoPushDeviceEntity)
    private readonly devicesRepository: Repository<UserExpoPushDeviceEntity>,
    @InjectRepository(NotificationDeliveryEntity)
    private readonly deliveriesRepository: Repository<NotificationDeliveryEntity>,
  ) {}

  async deliver(
    notificationId: string,
    pushData: ExpoPushSendJobData['pushData'],
    attemptCount: number,
  ): Promise<void> {
    const deliveryStats = { sent: 0, failed: 0 };
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId },
      relations: ['user'],
    });

    if (!notification) {
      this.logger.warn(
        expoPushWorkerLog(
          `skip push: notification not found (id=${notificationId})`,
        ),
      );
      return;
    }

    if (!notification.user?.id) {
      this.logger.warn(
        expoPushWorkerLog(
          `skip push: notification has no user (id=${notificationId})`,
        ),
      );
      return;
    }

    const easProjectId = process.env.EXPO_EAS_PROJECT_ID?.trim();
    const easEnvironment = process.env.EXPO_EAS_ENVIRONMENT?.trim();

    const devices = await this.devicesRepository.find({
      where: {
        user: { id: notification.user.id },
        isEnabled: true,
        ...(easProjectId ? { easProjectId } : {}),
        ...(easEnvironment ? { easEnvironment } : {}),
      },
      select: ['expoPushToken'],
    });

    if (!devices.length) {
      this.logger.warn(
        expoPushWorkerLog(
          `skip push: no enabled devices (notificationId=${notificationId}, userId=${notification.user.id})`,
        ),
      );
      return;
    }

    const expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
    });

    const messages = devices
      .filter((d) => Expo.isExpoPushToken(d.expoPushToken))
      .map((d) => ({
        to: d.expoPushToken,
        sound: 'default',
        title: notification.title,
        body: notification.message,
        data: {
          ...pushData,
          notificationId,
        },
      }));

    if (!messages.length) {
      this.logger.warn(
        expoPushWorkerLog(
          `skip push: no valid Expo tokens (notificationId=${notificationId})`,
        ),
      );
      return;
    }

    // Create/update delivery rows for this attempt.
    for (const message of messages) {
      await this.upsertDelivery(
        {
          notification,
          expoPushToken: message.to as string,
          status: 'queued',
          attemptCount,
          errorCode: null,
        },
        deliveryStats,
      );
    }

    const chunks = expo.chunkPushNotifications(messages);
    const receiptIdToToken = new Map<string, string>();
    const tickets: Array<{
      status: 'ok' | 'error';
      id?: string;
      message?: string;
      details?: { error?: string };
    }> = [];
    const failedTokensToDisable: string[] = [];
    let shouldRetry = false;

    for (const chunk of chunks) {
      // Spread load out over time; also keeps memory bounded.
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);

      for (let idx = 0; idx < chunk.length; idx++) {
        const message = chunk[idx];
        const token = message.to as string;
        const ticket = ticketChunk[idx];

        if (ticket?.status === 'ok' && ticket?.id) {
          receiptIdToToken.set(ticket.id, token);
          continue;
        }

        // Immediate ticket errors mean Expo couldn't enqueue; mark as failed.
        if (ticket?.status === 'error') {
          const detailsError = ticket.details?.error;
          await this.upsertDelivery(
            {
              notification,
              expoPushToken: token,
              status: 'failed',
              attemptCount,
              errorCode:
                detailsError ?? ticket.message ?? 'ExpoPushTicketError',
            },
            deliveryStats,
          );

          if (detailsError && expoTokenErrorCodesToDisable.has(detailsError)) {
            failedTokensToDisable.push(token);
          } else {
            shouldRetry = true;
            this.logger.warn(
              expoPushWorkerLog(
                `ticket failed notificationId=${notificationId} token=${token} error=${detailsError ?? ticket.message}`,
              ),
            );
          }
        } else {
          await this.upsertDelivery(
            {
              notification,
              expoPushToken: token,
              status: 'failed',
              attemptCount,
              errorCode: 'ExpoPushTicketError',
            },
            deliveryStats,
          );
          shouldRetry = true;
        }
      }
    }

    const receiptIds = tickets
      .filter((ticket) => ticket.status === 'ok' && ticket.id)
      .map((ticket) => ticket.id as string);

    if (!receiptIds.length) {
      if (failedTokensToDisable.length) {
        await this.devicesRepository.update(
          { expoPushToken: In(failedTokensToDisable) },
          { isEnabled: false },
        );
      }
      this.logDeliverySummary(
        notificationId,
        attemptCount,
        messages.length,
        deliveryStats,
        shouldRetry,
        'ticket_only',
      );
      if (shouldRetry) {
        throw new Error(`Expo push ticket delivery had failures`);
      }
      return;
    }

    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

    for (const chunk of receiptIdChunks) {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const [receiptId, receipt] of Object.entries(receipts)) {
        const token = receiptIdToToken.get(receiptId);

        if (receipt.status === 'ok') {
          await this.upsertDelivery(
            {
              notification,
              expoPushToken: token ?? '',
              status: 'sent',
              attemptCount,
              errorCode: null,
            },
            deliveryStats,
          );
          continue;
        }

        const detailsError = receipt.details?.error;

        await this.upsertDelivery(
          {
            notification,
            expoPushToken: token ?? '',
            status: 'failed',
            attemptCount,
            errorCode:
              detailsError ?? receipt.message ?? 'ExpoPushReceiptError',
          },
          deliveryStats,
        );

        if (
          token &&
          detailsError &&
          expoTokenErrorCodesToDisable.has(detailsError)
        ) {
          failedTokensToDisable.push(token);
        } else {
          // For any unexpected error, let BullMQ retry the whole job.
          shouldRetry = true;
        }

        this.logger.warn(
          expoPushWorkerLog(
            `receipt failed notificationId=${notificationId} error=${detailsError} receiptId=${receiptId}`,
          ),
        );
      }
    }

    if (failedTokensToDisable.length) {
      // Disable tokens so future notifications won't keep failing.
      await this.devicesRepository.update(
        { expoPushToken: In(failedTokensToDisable) },
        { isEnabled: false },
      );
    }

    this.logDeliverySummary(
      notificationId,
      attemptCount,
      messages.length,
      deliveryStats,
      shouldRetry,
      'receipts',
    );

    if (shouldRetry) {
      throw new Error(`Expo push delivery had failed receipts`);
    }
  }

  private logDeliverySummary(
    notificationId: string,
    attemptCount: number,
    tokenCount: number,
    stats: { sent: number; failed: number },
    shouldRetry: boolean,
    phase: 'ticket_only' | 'receipts',
  ): void {
    const base = expoPushWorkerLog(
      `summary notificationId=${notificationId} attempt=${attemptCount} tokens=${tokenCount} sent=${stats.sent} failed=${stats.failed} phase=${phase} willRetry=${shouldRetry}`,
    );
    if (stats.failed === 0 && !shouldRetry) {
      this.logger.log(base);
    } else {
      this.logger.warn(base);
    }
  }

  private async upsertDelivery(
    args: {
      notification: NotificationEntity;
      expoPushToken: string;
      status: string;
      attemptCount: number;
      errorCode: string | null;
    },
    stats?: { sent: number; failed: number },
  ): Promise<void> {
    if (!args.expoPushToken) return;

    if (stats) {
      if (args.status === 'sent') {
        stats.sent += 1;
      } else if (args.status === 'failed') {
        stats.failed += 1;
      }
    }

    const existing = await this.deliveriesRepository.findOne({
      where: {
        notification: { id: args.notification.id } as any,
        expoPushToken: args.expoPushToken,
      },
    });

    if (existing) {
      existing.status = args.status;
      existing.attemptCount = args.attemptCount;
      existing.errorCode = args.errorCode;
      await this.deliveriesRepository.save(existing);
      return;
    }

    const created = this.deliveriesRepository.create({
      notification: { id: args.notification.id } as any,
      expoPushToken: args.expoPushToken,
      status: args.status,
      attemptCount: args.attemptCount,
      errorCode: args.errorCode,
    });
    await this.deliveriesRepository.save(created);
  }
}
