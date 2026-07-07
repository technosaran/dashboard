import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransactionService, CreateTransactionInput } from "@/services/transaction-service";

describe("TransactionService", () => {
  let mockRepo: any;
  let mockCache: any;
  let service: TransactionService;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findByDateRange: vi.fn(),
      findByCategory: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getTransactionStats: vi.fn(),
    };

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    service = new TransactionService(mockRepo, mockCache);
  });

  describe("getTransaction", () => {
    it("should return cached transaction if available", async () => {
      const cachedTx = { id: "tx-1", amount: "100" };
      mockCache.get.mockResolvedValue(cachedTx);

      const result = await service.getTransaction("tx-1");

      expect(result).toEqual(cachedTx);
      expect(mockCache.get).toHaveBeenCalledWith("transaction:tx-1");
      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    it("should fetch from repository on cache miss and set cache", async () => {
      const dbTx = { id: "tx-1", amount: "100" };
      mockCache.get.mockResolvedValue(null);
      mockRepo.findById.mockResolvedValue(dbTx);

      const result = await service.getTransaction("tx-1");

      expect(result).toEqual(dbTx);
      expect(mockRepo.findById).toHaveBeenCalledWith("tx-1");
      expect(mockCache.set).toHaveBeenCalledWith("transaction:tx-1", dbTx, 300);
    });
  });

  describe("createTransaction", () => {
    it("should create transaction and invalidate stats cache", async () => {
      const input: CreateTransactionInput = {
        account_id: "acc-1",
        type: "expense",
        amount: "50",
        description: "Coffee",
      };
      const createdTx = { id: "tx-2", user_id: "user-1", ...input };
      mockRepo.create.mockResolvedValue(createdTx);

      const result = await service.createTransaction("user-1", input);

      expect(result).toEqual(createdTx);
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: "user-1",
        amount: "50",
      }));
      expect(mockCache.delete).toHaveBeenCalledWith("user:user-1:tx-stats");
    });
  });

  describe("getTransactionStats", () => {
    it("should return cached stats if available", async () => {
      const cachedStats = { totalIncome: 500, totalExpense: 200, count: 5 };
      mockCache.get.mockResolvedValue(cachedStats);

      const result = await service.getTransactionStats("user-1");

      expect(result).toEqual(cachedStats);
      expect(mockRepo.getTransactionStats).not.toHaveBeenCalled();
    });

    it("should fetch from repo and set cache on cache miss", async () => {
      const dbStats = { totalIncome: 500, totalExpense: 200, count: 5 };
      mockCache.get.mockResolvedValue(null);
      mockRepo.getTransactionStats.mockResolvedValue(dbStats);

      const result = await service.getTransactionStats("user-1");

      expect(result).toEqual(dbStats);
      expect(mockRepo.getTransactionStats).toHaveBeenCalledWith("user-1");
      expect(mockCache.set).toHaveBeenCalledWith("user:user-1:tx-stats", dbStats, 120);
    });
  });
});
