import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMulti = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
};

const mockRedis = {
  multi: vi.fn().mockReturnValue(mockMulti),
  del: vi.fn().mockResolvedValue(1),
};

vi.mock("@/lib/redis", () => {
  return {
    getRedisClient: vi.fn().mockImplementation(() => mockRedis),
    isRedisHealthy: vi.fn().mockReturnValue(true),
    redisGet: vi.fn(),
    redisSet: vi.fn(),
    redisDel: vi.fn(),
    redisIncr: vi.fn(),
    redisExpire: vi.fn(),
  };
});

import { RateLimiter, RATE_LIMIT_PRESETS } from "@/lib/rate-limiter";
import { getRedisClient, isRedisHealthy } from "@/lib/redis";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRedisHealthy).mockReturnValue(true);
    mockMulti.exec.mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]);
  });

  it("should initialize with custom config", () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
    expect(limiter).toBeDefined();
  });

  it("should allow request if within limits (Redis backend)", async () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000, keyPrefix: "test" });
    
    // Simulate count = 2
    mockMulti.exec.mockResolvedValue([[null, 0], [null, 1], [null, 2], [null, 1]]);

    const result = await limiter.check("user-ip");
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
    expect(result.limit).toBe(5);
    expect(mockRedis.multi).toHaveBeenCalled();
  });

  it("should deny request if limits exceeded (Redis backend)", async () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
    
    // Simulate count = 3 (exceeded maxRequests of 2)
    mockMulti.exec.mockResolvedValue([[null, 0], [null, 1], [null, 3], [null, 1]]);

    const result = await limiter.check("user-ip");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should fall back to in-memory window when Redis is unhealthy", async () => {
    vi.mocked(isRedisHealthy).mockReturnValue(false);
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000, keyPrefix: "mem-fallback" });

    // First request
    let result = await limiter.check("user-ip");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);

    // Second request
    result = await limiter.check("user-ip");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);

    // Third request
    result = await limiter.check("user-ip");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);

    // Fourth request (blocked)
    result = await limiter.check("user-ip");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should reset rate limit correctly", async () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
    await limiter.reset("user-ip");
    
    expect(mockRedis.del).toHaveBeenCalled();
  });
});
