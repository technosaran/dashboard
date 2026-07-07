/**
 * Account Repository Implementation.
 * Implements requirement 2.4: Repository pattern for accounts data.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { DatabaseError } from "@/lib/errors";
import { SupabaseRepository } from "./base-repository";

export type Account = Database["public"]["Tables"]["accounts"]["Row"];

export class AccountRepository extends SupabaseRepository<Account> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, "accounts");
  }

  /**
   * Finds all accounts for a specific user ID.
   */
  public async findByUserId(userId: string): Promise<Account[]> {
    return this.findAll({
      where: { user_id: userId },
      orderBy: [{ field: "name", direction: "asc" }],
    });
  }

  /**
   * Finds accounts by type (e.g. bank, credit, investment) for a user.
   */
  public async findByType(userId: string, type: string): Promise<Account[]> {
    return this.findAll({
      where: {
        user_id: userId,
        type,
      },
    });
  }

  /**
   * Computes the aggregated sum of all account balances for a user.
   */
  public async getTotalBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from("accounts")
        .select("balance")
        .eq("user_id", userId);

      if (error) throw new DatabaseError(error.message);

      return (data || []).reduce((acc, account) => {
        return acc + parseFloat(String(account.balance || "0"));
      }, 0);
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }
}
