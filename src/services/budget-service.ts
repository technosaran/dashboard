/**
 * Budget Service Layer.
 * Implements requirement 2.6: separate business logic from database.
 */

import { BudgetRepository, Budget } from "@/repositories/budget-repository";
import { TransactionRepository } from "@/repositories/transaction-repository";
import { CacheService, CACHE_TTL } from "@/lib/cache-service";

export interface CreateBudgetInput {
  category: string;
  amount: string;
  period_month: number;
  period_year: number;
}

export interface BudgetUtilization {
  category: string;
  budgeted: number;
  actualSpent: number;
  utilizationPercent: number;
}

export class BudgetService {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly cacheService?: CacheService
  ) {}

  /**
   * Fetches a budget by ID. Uses Cache-aside.
   */
  public async getBudget(id: string): Promise<Budget | null> {
    const cacheKey = `budget:${id}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<Budget>(cacheKey);
      if (cached) return cached;
    }

    const budget = await this.budgetRepo.findById(id);

    if (budget && this.cacheService) {
      await this.cacheService.set(cacheKey, budget, 300); // 5 mins
    }

    return budget;
  }

  /**
   * Fetches all budgets for a user.
   */
  public async getBudgets(userId: string): Promise<Budget[]> {
    return this.budgetRepo.findByUserId(userId);
  }

  /**
   * Creates a new budget. Invalidates utilization cache.
   */
  public async createBudget(userId: string, data: CreateBudgetInput): Promise<Budget> {
    const budget = await this.budgetRepo.create({
      ...data,
      user_id: userId,
    } as any);

    await this.invalidateUserCache(userId, data.period_month, data.period_year);
    return budget;
  }

  /**
   * Updates an existing budget. Invalidates caches.
   */
  public async updateBudget(
    id: string,
    userId: string,
    data: Partial<Budget>
  ): Promise<Budget | null> {
    const updated = await this.budgetRepo.update(id, data);
    
    if (updated) {
      if (this.cacheService) {
        await this.cacheService.delete(`budget:${id}`);
      }
      await this.invalidateUserCache(userId, updated.period_month, updated.period_year);
    }

    return updated;
  }

  /**
   * Deletes a budget. Invalidates caches.
   */
  public async deleteBudget(id: string, userId: string): Promise<boolean> {
    const budget = await this.budgetRepo.findById(id);
    if (!budget) return false;

    const deleted = await this.budgetRepo.delete(id);
    
    if (deleted) {
      if (this.cacheService) {
        await this.cacheService.delete(`budget:${id}`);
      }
      await this.invalidateUserCache(userId, budget.period_month, budget.period_year);
    }

    return deleted;
  }

  /**
   * Calculates monthly budget utilization by category (budget vs actual spent).
   * Uses Cache-aside pattern.
   */
  public async getBudgetUtilization(
    userId: string,
    month: number,
    year: number
  ): Promise<BudgetUtilization[]> {
    const cacheKey = `user:${userId}:budget-util:${year}-${month}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<BudgetUtilization[]>(cacheKey);
      if (cached !== null) return cached;
    }

    // 1. Fetch all budgets for the period
    const budgets = await this.budgetRepo.findByPeriod(userId, month, year);

    // 2. Fetch all transactions for the period (simplified date range filter)
    const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
    // End date is start of next month
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`;

    const transactions = await this.transactionRepo.findByDateRange(userId, startDate, endDate);

    // 3. Compute actual spent by category
    const spentByCategory = new Map<string, number>();
    transactions
      .filter((tx) => tx.type === "expense")
      .forEach((tx) => {
        const cat = tx.category || "Uncategorized";
        const amt = parseFloat(String(tx.amount || "0"));
        spentByCategory.set(cat, (spentByCategory.get(cat) || 0) + amt);
      });

    // 4. Map budgets to utilization structures
    const utilization: BudgetUtilization[] = budgets.map((b) => {
      const cat = b.category;
      const budgeted = parseFloat(String(b.amount || "0"));
      const actualSpent = spentByCategory.get(cat) || 0;
      const utilizationPercent = budgeted > 0 ? (actualSpent / budgeted) * 100 : 0;

      return {
        category: cat,
        budgeted,
        actualSpent,
        utilizationPercent,
      };
    });

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, utilization, CACHE_TTL.budgetSummary);
    }

    return utilization;
  }

  /**
   * Invalidates budget utilization cache for a user period.
   */
  private async invalidateUserCache(userId: string, month: number, year: number): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.delete(`user:${userId}:budget-util:${year}-${month}`);
    }
  }
}
