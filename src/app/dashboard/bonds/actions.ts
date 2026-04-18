"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type BondFormData = {
  bond_name: string;
  isin: string;
  issuer: string;
  bond_type: "Government" | "Corporate" | "Tax-Free" | "Infrastructure" | "PSU";
  face_value: number;
  quantity: number;
  purchase_price: number;
  current_price: number;
  coupon_rate: number;
  ytm?: number;
  purchase_date: string;
  maturity_date: string;
  next_interest_date?: string;
  interest_frequency: "Monthly" | "Quarterly" | "Semi-Annual" | "Annual";
  credit_rating?: string;
  platform?: string;
  demat_account?: string;
  account_id?: string;
  notes?: string;
};

export async function createBond(data: BondFormData) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const total_invested = data.purchase_price * data.quantity;
  const current_value = data.current_price * data.quantity;

  const { error } = await supabase.from("bonds").insert({
    user_id: user.id,
    bond_name: data.bond_name,
    isin: data.isin,
    issuer: data.issuer,
    bond_type: data.bond_type,
    face_value: data.face_value,
    quantity: data.quantity,
    purchase_price: data.purchase_price,
    current_price: data.current_price,
    total_invested,
    current_value,
    coupon_rate: data.coupon_rate,
    ytm: data.ytm,
    purchase_date: data.purchase_date,
    maturity_date: data.maturity_date,
    next_interest_date: data.next_interest_date,
    interest_frequency: data.interest_frequency,
    credit_rating: data.credit_rating,
    platform: data.platform || "Wint",
    demat_account: data.demat_account,
    notes: data.notes,
  });

  if (error) return { error: error.message };

  // Create buy transaction
  await supabase.from("bond_transactions").insert({
    user_id: user.id,
    transaction_type: "BUY",
    transaction_date: data.purchase_date,
    quantity: data.quantity,
    price_per_bond: data.purchase_price,
    amount: total_invested,
    account_id: data.account_id,
  });

  // Deduct from account if specified
  if (data.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", data.account_id)
      .single();

    if (account) {
      await supabase
        .from("accounts")
        .update({ balance: account.balance - total_invested })
        .eq("id", data.account_id);

      // Log in ledger
      await supabase.from("ledger_logs").insert({
        user_id: user.id,
        account_name: "Bond Investment",
        action_type: "ADJUST_DOWN",
        amount: total_invested,
        previous_balance: account.balance,
        new_balance: account.balance - total_invested,
        details: `Purchased ${data.quantity} units of ${data.bond_name} (${data.isin})`,
      });
    }
  }

  revalidatePath("/dashboard/bonds");
  return { success: true };
}

export async function updateBond(bondId: string, data: Partial<BondFormData>) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const updateData: any = { ...data };
  
  if (data.purchase_price && data.quantity) {
    updateData.total_invested = data.purchase_price * data.quantity;
  }
  
  if (data.current_price && data.quantity) {
    updateData.current_value = data.current_price * data.quantity;
  }

  const { error } = await supabase
    .from("bonds")
    .update(updateData)
    .eq("id", bondId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/bonds");
  return { success: true };
}

export async function deleteBond(bondId: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("bonds")
    .delete()
    .eq("id", bondId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/bonds");
  return { success: true };
}

export async function recordInterestPayment(bondId: string, data: {
  amount: number;
  payment_date: string;
  period_start: string;
  period_end: string;
  account_id?: string;
}) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Record transaction
  const { error } = await supabase.from("bond_transactions").insert({
    user_id: user.id,
    bond_id: bondId,
    transaction_type: "INTEREST",
    transaction_date: data.payment_date,
    amount: data.amount,
    interest_amount: data.amount,
    interest_period_start: data.period_start,
    interest_period_end: data.period_end,
    account_id: data.account_id,
  });

  if (error) return { error: error.message };

  // Update bond total interest earned
  const { data: bond } = await supabase
    .from("bonds")
    .select("total_interest_earned")
    .eq("id", bondId)
    .single();

  if (bond) {
    await supabase
      .from("bonds")
      .update({ 
        total_interest_earned: (bond.total_interest_earned || 0) + data.amount,
        accrued_interest: 0 // Reset accrued interest after payment
      })
      .eq("id", bondId);
  }

  // Credit to account if specified
  if (data.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", data.account_id)
      .single();

    if (account) {
      await supabase
        .from("accounts")
        .update({ balance: account.balance + data.amount })
        .eq("id", data.account_id);

      // Log in ledger
      await supabase.from("ledger_logs").insert({
        user_id: user.id,
        account_name: "Bond Interest",
        action_type: "ADJUST_UP",
        amount: data.amount,
        previous_balance: account.balance,
        new_balance: account.balance + data.amount,
        details: `Interest payment received for bond`,
      });
    }
  }

  revalidatePath("/dashboard/bonds");
  return { success: true };
}

// Fetch bond price from external API (placeholder - integrate with actual bond API)
export async function fetchBondPrice(isin: string) {
  // TODO: Integrate with Wint API or other bond data provider
  // For now, return mock data
  return {
    current_price: 1050,
    ytm: 7.5,
    accrued_interest: 25.50,
  };
}

// Auto-refresh bond prices
export async function refreshBondPrices() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: bonds } = await supabase
    .from("bonds")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "Active");

  if (!bonds) return { error: "No bonds found" };

  // Update prices for each bond
  for (const bond of bonds) {
    const priceData = await fetchBondPrice(bond.isin);
    
    await supabase
      .from("bonds")
      .update({
        current_price: priceData.current_price,
        current_value: priceData.current_price * bond.quantity,
        ytm: priceData.ytm,
        accrued_interest: priceData.accrued_interest,
      })
      .eq("id", bond.id);
  }

  revalidatePath("/dashboard/bonds");
  return { success: true };
}
