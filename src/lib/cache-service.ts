/**
 * Redis-backed Cache Service.
 * Implements requirement 4.4 and 4.5: Redis caching for frequently accessed data.
 */

import { redisGet, redisSet, redisDel, getRedisClient, isRedisHealthy } from "./redis";

export class CacheService {
  private defaultTtlSeconds = 300; // 5 minutes default

  /**
   * Retrieves a typed value from cache.
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisGet(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      console.error(`[CacheService] GET failed for key ${key}:`, err);
      return null;
    }
  }

  /**
   * Sets a value in cache with an optional TTL in seconds.
   */
  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const stringified = JSON.stringify(value);
      const ttl = ttlSeconds !== undefined ? ttlSeconds : this.defaultTtlSeconds;
      await redisSet(key, stringified, ttl);
    } catch (err) {
      console.error(`[CacheService] SET failed for key ${key}:`, err);
    }
  }

  /**
   * Deletes a key from cache.
   */
  public async delete(key: string): Promise<void> {
    try {
      await redisDel(key);
    } catch (err) {
      console.error(`[CacheService] DELETE failed for key ${key}:`, err);
    }
  }

  /**
   * Deletes keys matching a wildcard pattern (e.g. "user:123:*").
   */
  public async deletePattern(pattern: string): Promise<void> {
    const redis = getRedisClient();
    if (redis && isRedisHealthy()) {
      try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch (err) {
        console.error(`[CacheService] DELETE pattern ${pattern} failed:`, err);
      }
    }
  }

  /**
   * Flushes all cache contents.
   */
  public async flush(): Promise<void> {
    const redis = getRedisClient();
    if (redis && isRedisHealthy()) {
      try {
        await redis.flushdb();
      } catch (err) {
        console.error("[CacheService] FLUSH failed:", err);
      }
    }
  }

  /**
   * Gets a value from cache if it exists, otherwise calls factory to compute and stores it.
   */
  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

// TTL configuration presets (in seconds)
export const CACHE_TTL = {
  profile: 3600,       // 1 hour
  accountSummary: 300, // 5 minutes
  transactionStats: 120, // 2 minutes
  budgetSummary: 300,  // 5 minutes
};
