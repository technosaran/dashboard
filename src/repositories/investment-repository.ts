/**
 * Investment Repository Implementation.
 * Implements requirement 2.4: Repository pattern for investments data.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { DatabaseError } from "@/lib/errors";
import { SupabaseRepository } from "./base-repository";

export type Investment = Database["public"]["Tables"]["investments"]["Row"];

export class InvestmentRepository extends SupabaseRepository<Investment> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, "investments");
  }

  /**
   * Finds all investments for a specific user ID.
   */
  public async findByUserId(userId: string): Promise<Investment[]> {
    return this.findAll({
      where: { user_id: userId },
    });
  }

  /**
   * Finds an investment by ticker/symbol for a user.
   */
  public async findBySymbol(userId: string, symbol: string): Promise<Investment | null> {
    try {
      const { data, error } = await this.supabase
        .from("investments")
        .select("*")
        .eq("user_id", userId)
        .eq("symbol", symbol)
        .maybeSingle();

      if (error) throw new DatabaseError(error.message);
      return data as Investment | null;
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }

  /**
   * Computes aggregate total value of all holdings in the portfolio (quantity * current_price).
   */
  public async getPortfolioValue(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from("investments")
        .select("quantity, current_price")
        .eq("user_id", userId);

      if (error) throw new DatabaseError(error.message);

      return (data || []).reduce((acc, inv) => {
        const qty = parseFloat(String(inv.quantity || "0"));
        const price = parseFloat(String(inv.current_price || "0"));
        return acc + (qty * price);
      }, 0);
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }
}
