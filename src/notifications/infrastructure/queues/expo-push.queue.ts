import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createBullmqConnection } from '../bullmq-ioredis';
import {
  EXPO_PUSH_JOB_SEND_NAME,
  EXPO_PUSH_QUEUE_NAME,
  type ExpoPushSendJobData,
} from '../../worker/expo-push-job.types';

@Injectable()
export class ExpoPushQueue {
  private readonly queue: Queue<ExpoPushSendJobData>;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('Missing REDIS_URL (required for Expo push queue).');
    }

    const connection = createBullmqConnection(redisUrl);
    this.queue = new Queue(EXPO_PUSH_QUEUE_NAME, {
      connection,
    });
  }

  async enqueueSend(jobData: ExpoPushSendJobData): Promise<void> {
    await this.queue.add(EXPO_PUSH_JOB_SEND_NAME, jobData, {
      jobId: jobData.notificationId,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
    });
  }
}
