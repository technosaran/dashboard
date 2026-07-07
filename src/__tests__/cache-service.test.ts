import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => {
  const store = new Map<string, string>();
  return {
    redisGet: vi.fn().mockImplementation(async (key) => store.get(key) || null),
    redisSet: vi.fn().mockImplementation(async (key, val) => {
      store.set(key, val);
      return true;
    }),
    redisDel: vi.fn().mockImplementation(async (key) => {
      store.delete(key);
      return true;
    }),
    getRedisClient: vi.fn(),
    isRedisHealthy: vi.fn().mockReturnValue(true),
  };
});

import { CacheService } from "@/lib/cache-service";
import { redisGet, redisSet, redisDel } from "@/lib/redis";

describe("CacheService", () => {
  let cacheService: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheService = new CacheService();
  });

  it("should retrieve null if key does not exist", async () => {
    const result = await cacheService.get("missing-key");
    expect(result).toBeNull();
    expect(redisGet).toHaveBeenCalledWith("missing-key");
  });

  it("should set and get values correctly with JSON serialization", async () => {
    const testData = { name: "John Doe", active: true };
    await cacheService.set("user:123", testData);

    expect(redisSet).toHaveBeenCalledWith("user:123", JSON.stringify(testData), 300);

    const retrieved = await cacheService.get<typeof testData>("user:123");
    expect(retrieved).toEqual(testData);
  });

  it("should delete cache keys", async () => {
    await cacheService.set("user:123", "value");
    await cacheService.delete("user:123");

    expect(redisDel).toHaveBeenCalledWith("user:123");
    const retrieved = await cacheService.get("user:123");
    expect(retrieved).toBeNull();
  });

  it("should use getOrSet cache-aside pattern", async () => {
    const factory = vi.fn().mockResolvedValue("expensive-computed-value");

    // Cache Miss
    let value = await cacheService.getOrSet("key:1", factory, 60);
    expect(value).toBe("expensive-computed-value");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(redisSet).toHaveBeenCalledWith("key:1", JSON.stringify("expensive-computed-value"), 60);

    // Cache Hit (should not invoke factory again)
    value = await cacheService.getOrSet("key:1", factory, 60);
    expect(value).toBe("expensive-computed-value");
    expect(factory).toHaveBeenCalledTimes(1); // Still 1
  });
});
