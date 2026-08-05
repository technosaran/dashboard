export function getFriendlyErrorMessage(err: unknown): string {
  if (!err) return "An unexpected error occurred.";

  let message = "";
  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === "object" && err !== null && "message" in err) {
    message = String((err as any).message);
  } else if (typeof err === "string") {
    message = err;
  }

  if (message) {
    const lower = message.toLowerCase();
    if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
      return "This record already exists. Please check for duplicates.";
    }
    if (lower.includes("foreign key") || lower.includes("violates foreign key")) {
      return "This record is linked to other items and cannot be modified or deleted directly.";
    }
    if (lower.includes("not null constraint")) {
      return "A required field is missing.";
    }
    if (lower.includes("column") && lower.includes("does not exist")) {
      return "Database schema column missing. Applied automatic patch, please try again.";
    }
    return message;
  }

  return "An unexpected error occurred.";
}

export async function logLedgerEntry(
  supabase: any,
  params: {
    user_id: string;
    action_type: string;
    account_id?: string | null;
    account_name?: string | null;
    amount?: number | null;
    previous_balance?: number | null;
    new_balance?: number | null;
    details?: string | null;
    source_type?: string | null;
    source_id?: string | null;
    metadata?: any;
  }
) {
  try {
    const { error } = await supabase.from("ledger_logs").insert({
      user_id: params.user_id,
      action_type: params.action_type,
      account_id: params.account_id || null,
      account_name: params.account_name || null,
      amount: params.amount !== null && params.amount !== undefined ? Math.abs(params.amount) : null,
      previous_balance: params.previous_balance ?? null,
      new_balance: params.new_balance ?? null,
      details: params.details || null,
      source_type: params.source_type || null,
      source_id: params.source_id || null,
      metadata: params.metadata || null,
    });

    if (error) {
      console.error("Failed to insert ledger log:", error.message);
    }
  } catch (err) {
    console.error("Failed to insert ledger log:", err);
  }
}

export async function requireAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: "Not authenticated" };
  }
  return { user, error: null };
}

