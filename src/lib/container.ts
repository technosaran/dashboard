/**
 * Simple, lightweight Dependency Injection Container.
 * Implements requirement 2.5: dependency injection for external service dependencies.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { CacheService } from "@/lib/cache-service";
import { TransactionRepository } from "@/repositories/transaction-repository";
import { AccountRepository } from "@/repositories/account-repository";
import { BudgetRepository } from "@/repositories/budget-repository";
import { InvestmentRepository } from "@/repositories/investment-repository";
import { TransactionService } from "@/services/transaction-service";
import { AccountService } from "@/services/account-service";
import { BudgetService } from "@/services/budget-service";

export class Container {
  private singletons = new Map<string, any>();
  private factories = new Map<string, () => any>();

  /**
   * Registers a factory function that will create a new instance on every resolve.
   */
  public register<T>(key: string, factory: () => T): void {
    this.factories.set(key, factory);
  }

  /**
   * Registers a factory function that will create a singleton instance on first resolve.
   */
  public singleton<T>(key: string, factory: () => T): void {
    this.factories.set(key, () => {
      if (!this.singletons.has(key)) {
        this.singletons.set(key, factory());
      }
      return this.singletons.get(key);
    });
  }

  /**
   * Resolves a dependency by key.
   */
  public resolve<T>(key: string): T {
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Dependency not registered: ${key}`);
    }
    return factory() as T;
  }

  /**
   * Checks if a dependency is registered.
   */
  public has(key: string): boolean {
    return this.factories.has(key);
  }

  /**
   * Resets all singletons and factories. Useful in tests.
   */
  public reset(): void {
    this.singletons.clear();
    this.factories.clear();
  }
}

/**
 * Creates and initializes the application DI container with repositories and services.
 */
export function createAppContainer(supabaseClient: SupabaseClient<Database>): Container {
  const container = new Container();

  // 1. Register Core Infrastructure
  container.singleton("supabase", () => supabaseClient);
  container.singleton("cacheService", () => new CacheService());

  // 2. Register Repositories
  container.singleton("transactionRepo", () => 
    new TransactionRepository(container.resolve("supabase"))
  );
  container.singleton("accountRepo", () => 
    new AccountRepository(container.resolve("supabase"))
  );
  container.singleton("budgetRepo", () => 
    new BudgetRepository(container.resolve("supabase"))
  );
  container.singleton("investmentRepo", () => 
    new InvestmentRepository(container.resolve("supabase"))
  );

  // 3. Register Services
  container.singleton("transactionService", () => 
    new TransactionService(
      container.resolve("transactionRepo"),
      container.resolve("cacheService")
    )
  );
  container.singleton("accountService", () => 
    new AccountService(
      container.resolve("accountRepo"),
      container.resolve("cacheService")
    )
  );
  container.singleton("budgetService", () => 
    new BudgetService(
      container.resolve("budgetRepo"),
      container.resolve("transactionRepo"),
      container.resolve("cacheService")
    )
  );

  return container;
}
