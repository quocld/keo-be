import { Injectable } from '@nestjs/common';
import IORedis from 'ioredis';

export type LastKnownLocation = {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number | null;
  speed?: number | null;
};

@Injectable()
export class LocationCacheService {
  private readonly redis: IORedis;
  private readonly ttlSeconds = 6 * 60 * 60;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('Missing REDIS_URL (required for location cache).');
    }
    this.redis = new IORedis(redisUrl);
  }

  driverKey(driverId: number): string {
    return `driver:${driverId}:last_location`;
  }

  tripKey(tripId: string): string {
    return `trip:${tripId}:last_location`;
  }

  async setDriverLastLocation(
    driverId: number,
    loc: LastKnownLocation,
  ): Promise<void> {
    await this.redis.set(
      this.driverKey(driverId),
      JSON.stringify(loc),
      'EX',
      this.ttlSeconds,
    );
  }

  async setTripLastLocation(
    tripId: string,
    loc: LastKnownLocation,
  ): Promise<void> {
    await this.redis.set(
      this.tripKey(tripId),
      JSON.stringify(loc),
      'EX',
      this.ttlSeconds,
    );
  }

  async getDriverLastLocation(
    driverId: number,
  ): Promise<LastKnownLocation | null> {
    const raw = await this.redis.get(this.driverKey(driverId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as LastKnownLocation;
    } catch {
      return null;
    }
  }

  async getTripLastLocation(tripId: string): Promise<LastKnownLocation | null> {
    const raw = await this.redis.get(this.tripKey(tripId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as LastKnownLocation;
    } catch {
      return null;
    }
  }

  async getDriversLastLocations(
    driverIds: number[],
  ): Promise<Record<number, LastKnownLocation | null>> {
    const out: Record<number, LastKnownLocation | null> = {};
    if (driverIds.length === 0) {
      return out;
    }

    const pipeline = this.redis.pipeline();
    for (const id of driverIds) {
      pipeline.get(this.driverKey(id));
    }
    const results = await pipeline.exec();

    for (let i = 0; i < driverIds.length; i++) {
      const driverId = driverIds[i];
      const [, value] = results?.[i] ?? [];
      if (value == null) {
        out[driverId] = null;
        continue;
      }
      try {
        if (typeof value !== 'string') {
          out[driverId] = null;
          continue;
        }
        out[driverId] = JSON.parse(value) as LastKnownLocation;
      } catch {
        out[driverId] = null;
      }
    }
    return out;
  }

  /**
   * Simple per-driver rate limit. Returns false when over limit.
   */
  async rateLimitDriver(
    driverId: number,
    windowSeconds: number,
    maxRequests: number,
  ): Promise<boolean> {
    const key = `driver:${driverId}:location_rl:${windowSeconds}`;
    const tx = this.redis.multi();
    tx.incr(key);
    tx.expire(key, windowSeconds, 'NX');
    const res = await tx.exec();
    const count = Number(res?.[0]?.[1] ?? 0);
    return count <= maxRequests;
  }
}
