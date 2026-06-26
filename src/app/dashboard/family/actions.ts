"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type RpcResult = {
  success: boolean;
  error?: string | null;
};

/* ── Family Members (family_members table) ── */

export async function addFamilyMember(data: { name: string; relationship: string }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!data.name || data.name.trim().length === 0) {
      return { error: "Name is required" };
    }
    if (!data.relationship || data.relationship.trim().length === 0) {
      return { error: "Relationship is required" };
    }

    const { error } = await supabase.from("family_members").insert({
      user_id: user.id,
      name: data.name.trim(),
      relationship: data.relationship.trim(),
      balance: 0,
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/family");
    return { success: true };
  } catch (err) {
    console.error("Error in addFamilyMember:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateFamilyMember(id: string, data: { name: string; relationship: string }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!id) return { error: "Member ID is required" };
    if (!data.name || data.name.trim().length === 0) {
      return { error: "Name is required" };
    }
    if (!data.relationship || data.relationship.trim().length === 0) {
      return { error: "Relationship is required" };
    }

    const { error } = await supabase
      .from("family_members")
      .update({
        name: data.name.trim(),
        relationship: data.relationship.trim(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/family");
    return { success: true };
  } catch (err) {
    console.error("Error in updateFamilyMember:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteFamilyMember(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!id) return { error: "Member ID is required" };

    const { error } = await supabase
      .from("family_members")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/family");
    return { success: true };
  } catch (err) {
    console.error("Error in deleteFamilyMember:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/* ── Allowances (family_allowances table) ── */

export async function createAllowance(data: {
  family_member_id: string;
  amount: number;
  frequency: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!data.family_member_id) return { error: "Member is required" };
    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Amount must be a positive number" };
    }
    if (!data.frequency || data.frequency.trim().length === 0) {
      return { error: "Frequency is required" };
    }

    // We also need to fetch/specify the default account, or wait, does the allowance have an account ID?
    // Wait, the new schema does NOT have account_id in family_allowances:
    // export const familyAllowances = pgTable("family_allowances", {
    //   id: uuid("id").defaultRandom().primaryKey(),
    //   user_id: uuid("user_id").notNull(),
    //   family_member_id: uuid("family_member_id").notNull(),
    //   amount: numeric("amount").notNull(),
    //   frequency: text("frequency").notNull(),
    //   last_paid_at: timestamp("last_paid_at"),
    //   created_at: timestamp("created_at").defaultNow().notNull(),
    // });
    // So there is NO account_id column! That's why the payAllowance RPC takes account_id as a parameter!
    // Perfect, let's insert without account_id.
    const { error } = await supabase.from("family_allowances").insert({
      user_id: user.id,
      family_member_id: data.family_member_id,
      amount: data.amount,
      frequency: data.frequency,
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/family");
    return { success: true };
  } catch (err) {
    console.error("Error in createAllowance:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateAllowance(
  id: string,
  data: {
    amount: number;
    frequency: string;
  }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!id) return { error: "Allowance ID is required" };
    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Amount must be a positive number" };
    }
    if (!data.frequency || data.frequency.trim().length === 0) {
      return { error: "Frequency is required" };
    }

    const { error } = await supabase
      .from("family_allowances")
      .update({
        amount: data.amount,
        frequency: data.frequency,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/family");
    return { success: true };
  } catch (err) {
    console.error("Error in updateAllowance:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteAllowance(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!id) return { error: "Allowance ID is required" };

    const { error } = await supabase
      .from("family_allowances")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/family");
    return { success: true };
  } catch (err) {
    console.error("Error in deleteAllowance:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/* ── Transfers (family_transfers table & RPCs) ── */

export async function processFamilyTransfer(data: {
  family_member_id: string;
  account_id: string;
  amount: number;
  type: string;
  note?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!data.family_member_id) return { error: "Recipient is required" };
    if (!data.account_id) return { error: "Account is required" };
    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Amount must be a positive number" };
    }

    const { data: rpcData, error } = await supabase.rpc("process_family_transfer_v2", {
      p_user_id: user.id,
      p_family_member_id: data.family_member_id,
      p_account_id: data.account_id,
      p_amount: data.amount,
      p_type: data.type || "gift",
      p_note: data.note || undefined,
    });

    if (error) return { error: error.message };
    const res = rpcData as RpcResult | null;
    if (!res?.success) return { error: res?.error || "Transfer failed" };

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");
    return { success: true };
  } catch (err) {
    console.error("Error in processFamilyTransfer:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function payAllowance(data: { allowance_id: string; account_id: string }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!data.allowance_id) return { error: "Allowance ID is required" };
    if (!data.account_id) return { error: "Account is required" };

    const { data: rpcData, error } = await supabase.rpc("pay_family_allowance", {
      p_user_id: user.id,
      p_allowance_id: data.allowance_id,
      p_account_id: data.account_id,
    });

    if (error) return { error: error.message };
    const res = rpcData as RpcResult | null;
    if (!res?.success) return { error: res?.error || "Payment failed" };

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");
    return { success: true };
  } catch (err) {
    console.error("Error in payAllowance:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
