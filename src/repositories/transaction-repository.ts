/**
 * Transaction Repository Implementation.
 * Implements requirement 2.4: Repository pattern for transactions data.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { DatabaseError } from "@/lib/errors";
import { SupabaseRepository, QueryFilters } from "./base-repository";

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

export class TransactionRepository extends SupabaseRepository<Transaction> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, "transactions");
  }

  /**
   * Finds all transactions for a specific user ID with optional query filters.
   */
  public async findByUserId(userId: string, filters?: QueryFilters): Promise<Transaction[]> {
    const enrichedFilters = {
      ...filters,
      where: {
        ...filters?.where,
        user_id: userId,
      },
    };
    return this.findAll(enrichedFilters);
  }

  /**
   * Finds all transactions for a user within a specific date range.
   */
  public async findByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    try {
      const { data, error } = await this.supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (error) throw new DatabaseError(error.message);
      return (data || []) as Transaction[];
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }

  /**
   * Finds transactions by category for a user.
   */
  public async findByCategory(userId: string, category: string): Promise<Transaction[]> {
    return this.findAll({
      where: {
        user_id: userId,
        category,
      },
      orderBy: [{ field: "date", direction: "desc" }],
    });
  }

  /**
   * Computes aggregated transaction stats for a user (total income, total expense, count).
   */
  public async getTransactionStats(
    userId: string
  ): Promise<{ totalIncome: number; totalExpense: number; count: number }> {
    try {
      const { data, error } = await this.supabase
        .from("transactions")
        .select("amount, type")
        .eq("user_id", userId);

      if (error) throw new DatabaseError(error.message);

      let totalIncome = 0;
      let totalExpense = 0;
      const count = data?.length || 0;

      data?.forEach((tx) => {
        const amt = parseFloat(String(tx.amount || "0"));
        if (tx.type === "income") {
          totalIncome += amt;
        } else if (tx.type === "expense") {
          totalExpense += amt;
        }
      });

      return {
        totalIncome,
        totalExpense,
        count,
      };
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }
}
