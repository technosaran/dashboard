/**
 * Transaction Service Layer.
 * Implements requirement 2.6: separate business logic from database.
 */

import { TransactionRepository, Transaction } from "@/repositories/transaction-repository";
import { CacheService, CACHE_TTL } from "@/lib/cache-service";
import { QueryFilters } from "@/repositories/base-repository";

export interface CreateTransactionInput {
  account_id: string;
  type: string;
  amount: string;
  description: string;
  category?: string;
  date?: string;
  source_type?: string;
  source_id?: string;
}

export class TransactionService {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly cacheService?: CacheService
  ) {}

  /**
   * Fetches a transaction by ID. Uses cache-aside pattern.
   */
  public async getTransaction(id: string): Promise<Transaction | null> {
    const cacheKey = `transaction:${id}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<Transaction>(cacheKey);
      if (cached) return cached;
    }

    const transaction = await this.transactionRepo.findById(id);

    if (transaction && this.cacheService) {
      await this.cacheService.set(cacheKey, transaction, 300); // 5 mins
    }

    return transaction;
  }

  /**
   * Fetches all transactions for a user.
   */
  public async getTransactions(userId: string, filters?: QueryFilters): Promise<Transaction[]> {
    return this.transactionRepo.findByUserId(userId, filters);
  }

  /**
   * Creates a transaction. Invalidates stats cache.
   */
  public async createTransaction(userId: string, data: CreateTransactionInput): Promise<Transaction> {
    const tx = await this.transactionRepo.create({
      ...data,
      user_id: userId,
    } as any);

    await this.invalidateUserCache(userId);
    return tx;
  }

  /**
   * Updates a transaction. Invalidates caches.
   */
  public async updateTransaction(id: string, userId: string, data: Partial<Transaction>): Promise<Transaction | null> {
    const updated = await this.transactionRepo.update(id, data);
    
    if (updated) {
      if (this.cacheService) {
        await this.cacheService.delete(`transaction:${id}`);
      }
      await this.invalidateUserCache(userId);
    }

    return updated;
  }

  /**
   * Deletes a transaction. Invalidates caches.
   */
  public async deleteTransaction(id: string, userId: string): Promise<boolean> {
    const deleted = await this.transactionRepo.delete(id);
    
    if (deleted) {
      if (this.cacheService) {
        await this.cacheService.delete(`transaction:${id}`);
      }
      await this.invalidateUserCache(userId);
    }

    return deleted;
  }

  /**
   * Gets aggregated stats (income, expense, counts) for user. Uses Cache-aside.
   */
  public async getTransactionStats(
    userId: string
  ): Promise<{ totalIncome: number; totalExpense: number; count: number }> {
    const cacheKey = `user:${userId}:tx-stats`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    const stats = await this.transactionRepo.getTransactionStats(userId);

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, stats, CACHE_TTL.transactionStats);
    }

    return stats;
  }

  /**
   * Invalidates caches associated with a user.
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.delete(`user:${userId}:tx-stats`);
    }
  }
}
