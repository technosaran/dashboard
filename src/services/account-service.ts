/**
 * Account Service Layer.
 * Implements requirement 2.6: separate business logic from database.
 */

import { AccountRepository, Account } from "@/repositories/account-repository";
import { CacheService, CACHE_TTL } from "@/lib/cache-service";

export interface CreateAccountInput {
  name: string;
  type: string;
  balance: string;
  currency?: string;
  bank_name?: string;
  account_number?: string;
  color?: string;
}

export class AccountService {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly cacheService?: CacheService
  ) {}

  /**
   * Fetches an account by ID. Uses Cache-aside.
   */
  public async getAccount(id: string): Promise<Account | null> {
    const cacheKey = `account:${id}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<Account>(cacheKey);
      if (cached) return cached;
    }

    const account = await this.accountRepo.findById(id);

    if (account && this.cacheService) {
      await this.cacheService.set(cacheKey, account, 300); // 5 mins
    }

    return account;
  }

  /**
   * Fetches all accounts for a user.
   */
  public async getAccounts(userId: string): Promise<Account[]> {
    return this.accountRepo.findByUserId(userId);
  }

  /**
   * Creates a new account. Invalidates aggregate balance cache.
   */
  public async createAccount(userId: string, data: CreateAccountInput): Promise<Account> {
    const account = await this.accountRepo.create({
      ...data,
      user_id: userId,
    } as any);

    await this.invalidateUserCache(userId);
    return account;
  }

  /**
   * Updates an account. Invalidates caches.
   */
  public async updateAccount(id: string, userId: string, data: Partial<Account>): Promise<Account | null> {
    const updated = await this.accountRepo.update(id, data);
    
    if (updated) {
      if (this.cacheService) {
        await this.cacheService.delete(`account:${id}`);
      }
      await this.invalidateUserCache(userId);
    }

    return updated;
  }

  /**
   * Deletes an account. Invalidates caches.
   */
  public async deleteAccount(id: string, userId: string): Promise<boolean> {
    const deleted = await this.accountRepo.delete(id);
    
    if (deleted) {
      if (this.cacheService) {
        await this.cacheService.delete(`account:${id}`);
      }
      await this.invalidateUserCache(userId);
    }

    return deleted;
  }

  /**
   * Retrieves aggregated total balance for a user. Uses Cache-aside.
   */
  public async getTotalBalance(userId: string): Promise<number> {
    const cacheKey = `user:${userId}:total-balance`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<number>(cacheKey);
      if (cached !== null) return cached;
    }

    const total = await this.accountRepo.getTotalBalance(userId);

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, total, CACHE_TTL.accountSummary);
    }

    return total;
  }

  /**
   * Invalidates caches associated with a user.
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.delete(`user:${userId}:total-balance`);
    }
  }
}
