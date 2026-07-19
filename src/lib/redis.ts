/* eslint-disable no-console */
import Redis, { RedisOptions } from 'ioredis';

/**
 * Redis client wrapper for distributed caching and rate limiting
 * 
 * Features:
 * - Singleton pattern to avoid multiple connections
 * - Automatic fallback to in-memory storage when Redis is unavailable
 * - Connection health monitoring
 * - Graceful degradation
 */

let redisClient: Redis | null = null;
let isRedisAvailable = false;

// In-memory fallback for development/testing when Redis is not available
const inMemoryStore = new Map<string, { value: string; expiresAt: number }>();

export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not configured. Using in-memory fallback for rate limiting.');
    return null;
  }

  try {
    const options: RedisOptions = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    redisClient = new Redis(redisUrl, options);

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
      isRedisAvailable = true;
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Ready to accept commands');
      isRedisAvailable = true;
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
      isRedisAvailable = false;
    });

    redisClient.on('close', () => {
      console.warn('[Redis] Connection closed');
      isRedisAvailable = false;
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to initialize client:', error);
    return null;
  }
}

let hasLoggedRedisWarning = false;

export function isRedisConfigured(): boolean {
  const isConfigured = Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '');
  if (!isConfigured && !hasLoggedRedisWarning) {
    console.warn('[Redis] REDIS_URL not configured. Multi-step pending-state Telegram flows and distributed rate limiting will not work reliably across Vercel serverless instances.');
    hasLoggedRedisWarning = true;
  }
  return isConfigured;
}

export function isRedisHealthy(): boolean {
  return isRedisAvailable && redisClient !== null && redisClient.status === 'ready';
}

/**
 * Get a value from Redis with in-memory fallback
 */
export async function redisGet(key: string): Promise<string | null> {
  const client = getRedisClient();
  
  if (client && isRedisHealthy()) {
    try {
      return await client.get(key);
    } catch (error) {
      console.error('[Redis] GET error:', error);
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback
  const item = inMemoryStore.get(key);
  if (!item) return null;
  
  if (item.expiresAt < Date.now()) {
    inMemoryStore.delete(key);
    return null;
  }
  
  return item.value;
}

/**
 * Set a value in Redis with in-memory fallback
 */
export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<boolean> {
  const client = getRedisClient();
  
  if (client && isRedisHealthy()) {
    try {
      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, value);
      } else {
        await client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('[Redis] SET error:', error);
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Number.MAX_SAFE_INTEGER;
  inMemoryStore.set(key, { value, expiresAt });
  return true;
}

/**
 * Delete a key from Redis with in-memory fallback
 */
export async function redisDel(key: string): Promise<boolean> {
  const client = getRedisClient();
  
  if (client && isRedisHealthy()) {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error('[Redis] DEL error:', error);
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback
  inMemoryStore.delete(key);
  return true;
}

/**
 * Increment a value in Redis with in-memory fallback
 */
export async function redisIncr(key: string): Promise<number> {
  const client = getRedisClient();
  
  if (client && isRedisHealthy()) {
    try {
      return await client.incr(key);
    } catch (error) {
      console.error('[Redis] INCR error:', error);
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback
  const item = inMemoryStore.get(key);
  const currentValue = item ? parseInt(item.value, 10) : 0;
  const newValue = currentValue + 1;
  
  inMemoryStore.set(key, {
    value: newValue.toString(),
    expiresAt: item?.expiresAt || Number.MAX_SAFE_INTEGER,
  });
  
  return newValue;
}

/**
 * Set expiration on a key
 */
export async function redisExpire(key: string, ttlSeconds: number): Promise<boolean> {
  const client = getRedisClient();
  
  if (client && isRedisHealthy()) {
    try {
      await client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.error('[Redis] EXPIRE error:', error);
      // Fall through to in-memory fallback
    }
  }

  // In-memory fallback
  const item = inMemoryStore.get(key);
  if (item) {
    item.expiresAt = Date.now() + ttlSeconds * 1000;
  }
  return true;
}

/**
 * Clean up expired entries from in-memory store
 */
function cleanupInMemoryStore() {
  const now = Date.now();
  for (const [key, item] of inMemoryStore.entries()) {
    if (item.expiresAt < now) {
      inMemoryStore.delete(key);
    }
  }
}

// Run cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupInMemoryStore, 60000);
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      isRedisAvailable = false;
      console.log('[Redis] Connection closed gracefully');
    } catch (error) {
      console.error('[Redis] Error closing connection:', error);
    }
  }
}
