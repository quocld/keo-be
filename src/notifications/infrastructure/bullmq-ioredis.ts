import IORedis from 'ioredis';

/**
 * BullMQ uses blocking Redis commands; ioredis defaults break that unless
 * maxRetriesPerRequest is null. See: https://docs.bullmq.io/guide/connections
 */
export function createBullmqConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}
