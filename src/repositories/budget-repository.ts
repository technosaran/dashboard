/**
 * Budget Repository Implementation.
 * Implements requirement 2.4: Repository pattern for budgets data.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { DatabaseError } from "@/lib/errors";
import { SupabaseRepository } from "./base-repository";

export type Budget = Database["public"]["Tables"]["budgets"]["Row"];

export class BudgetRepository extends SupabaseRepository<Budget> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, "budgets");
  }

  /**
   * Finds all budgets for a user.
   */
  public async findByUserId(userId: string): Promise<Budget[]> {
    return this.findAll({
      where: { user_id: userId },
    });
  }

  /**
   * Finds budgets for a user in a specific month and year period.
   */
  public async findByPeriod(userId: string, month: number, year: number): Promise<Budget[]> {
    return this.findAll({
      where: {
        user_id: userId,
        period_month: month,
        period_year: year,
      },
    });
  }

  /**
   * Finds a specific category budget for a user in the current month/year.
   */
  public async findByCategory(
    userId: string,
    category: string,
    month?: number,
    year?: number
  ): Promise<Budget | null> {
    try {
      const now = new Date();
      const currentMonth = month !== undefined ? month : now.getMonth() + 1;
      const currentYear = year !== undefined ? year : now.getFullYear();

      const { data, error } = await this.supabase
        .from("budgets")
        .select("*")
        .eq("user_id", userId)
        .eq("category", category)
        .eq("period_month", currentMonth)
        .eq("period_year", currentYear)
        .maybeSingle();

      if (error) throw new DatabaseError(error.message);
      return data as Budget | null;
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }
}
