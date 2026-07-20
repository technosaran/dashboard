/**
 * Redis-backed Sliding Window Rate Limiter.
 * Implements requirement 1.1: Rate limiting middleware with Redis.
 */

import { getRedisClient, isRedisHealthy } from "./redis";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

// In-memory fallback store for when Redis is unavailable
const memoryStore = new Map<string, number[]>();

// Periodically clean up memoryStore to prevent memory leaks
const gcInterval = setInterval(() => {
  const now = Date.now();
  // Assume a safe max window of 1 hour (3600000 ms) for cleanup
  for (const [key, timestamps] of memoryStore.entries()) {
    if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > 3600000) {
      memoryStore.delete(key);
    }
  }
}, 60000);
if (gcInterval.unref) gcInterval.unref();

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private keyPrefix: string;

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.keyPrefix = config.keyPrefix || "rl";
  }

  /**
   * Checks if the key is within rate limits.
   */
  public async check(key: string): Promise<RateLimitResult> {
    const fullKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const resetAt = new Date(now + this.windowMs);

    const redis = getRedisClient();
    if (redis && isRedisHealthy()) {
      try {
        const member = `${now}:${crypto.randomUUID()}`;
        
        // Pipeline/multi for atomic operations
        const pipeline = redis.multi();
        pipeline.zremrangebyscore(fullKey, 0, windowStart);
        pipeline.zadd(fullKey, now, member);
        pipeline.zcard(fullKey);
        pipeline.expire(fullKey, Math.ceil(this.windowMs / 1000));
        
        const results = await pipeline.exec();
        if (results && results[2]) {
          const count = results[2][1] as number;
          const allowed = count <= this.maxRequests;
          const remaining = Math.max(0, this.maxRequests - count);

          return {
            allowed,
            remaining,
            resetAt,
            limit: this.maxRequests,
          };
        }
      } catch (err) {
        console.error("[RateLimiter] Redis error, falling back to memory:", err);
      }
    }

    // In-memory fallback sliding window counter
    let timestamps = memoryStore.get(fullKey) || [];
    // Clean old timestamps
    timestamps = timestamps.filter((t) => t > windowStart);
    
    // Add current timestamp
    timestamps.push(now);
    memoryStore.set(fullKey, timestamps);

    const count = timestamps.length;
    const allowed = count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - count);

    return {
      allowed,
      remaining,
      resetAt,
      limit: this.maxRequests,
    };
  }

  /**
   * Resets rate limit counter for a key.
   */
  public async reset(key: string): Promise<void> {
    const fullKey = `${this.keyPrefix}:${key}`;
    const redis = getRedisClient();
    if (redis && isRedisHealthy()) {
      try {
        await redis.del(fullKey);
      } catch (err) {
        console.error("[RateLimiter] Redis reset error:", err);
      }
    }
    memoryStore.delete(fullKey);
  }
}

/**
 * Factory to create rate limiter instances
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

// Preset configurations
export const RATE_LIMIT_PRESETS = {
  sync: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 req/min
    keyPrefix: "rl:sync",
  },
  reports: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 30 req/min
    keyPrefix: "rl:reports",
  },
  general: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 100 req/min
    keyPrefix: "rl:general",
  },
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 5 req/min
    keyPrefix: "rl:auth",
  },
};
