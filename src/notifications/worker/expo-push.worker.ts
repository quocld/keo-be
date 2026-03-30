import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createBullmqConnection } from '../infrastructure/bullmq-ioredis';
import {
  EXPO_PUSH_JOB_SEND_NAME,
  EXPO_PUSH_QUEUE_NAME,
  type ExpoPushSendJobData,
} from './expo-push-job.types';
import { ExpoPushDeliveryService } from '../services/expo-push-delivery.service';

@Injectable()
export class ExpoPushWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpoPushWorker.name);
  private worker?: Worker<ExpoPushSendJobData, void, string>;
  private connection?: IORedis;

  constructor(
    private readonly expoPushDeliveryService: ExpoPushDeliveryService,
  ) {}

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('Missing REDIS_URL (required for Expo push worker).');
    }

    this.connection = createBullmqConnection(redisUrl);

    this.worker = new Worker<ExpoPushSendJobData, void, string>(
      EXPO_PUSH_QUEUE_NAME,
      async (job) => {
        if (job.name !== EXPO_PUSH_JOB_SEND_NAME) {
          return;
        }

        await this.expoPushDeliveryService.deliver(
          job.data.notificationId,
          job.data.pushData,
          (job.attemptsMade ?? 0) + 1,
        );
      },
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Expo push job failed (jobId=${job?.id}, name=${job?.name}): ${String(err)}`,
      );
    });
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close();
    } catch {
      // ignore
    }
    try {
      this.connection?.disconnect();
    } catch {
      // ignore
    }
  }
}
