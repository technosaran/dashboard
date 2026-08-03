import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  return NextResponse.json({
    status: "online",
    server: "FinanceOS MCP HTTP Bridge",
    version: "1.0.0",
    tools: [
      "get_financial_overview",
      "list_accounts",
      "list_recent_transactions",
      "add_transaction",
      "get_portfolio_summary",
      "search_ledger",
    ],
  });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access. Valid session required." }, { status: 401 });
    }

    const body = await request.json();
    const { name, arguments: args } = body;

    if (name === "get_financial_overview") {
      const [{ data: accountsArr }, { data: expensesArr }, { data: incomesArr }, { data: liabilitiesArr }] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", user.id),
        supabase.from("expenses").select("*").eq("user_id", user.id),
        supabase.from("incomes").select("*").eq("user_id", user.id),
        supabase.from("liabilities").select("*").eq("user_id", user.id),
      ]);

      const totalBalance = (accountsArr || []).reduce((acc, curr) => acc + Number(curr.balance || 0), 0);
      const totalExpenses = (expensesArr || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const totalIncomes = (incomesArr || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const totalLiabilities = (liabilitiesArr || []).reduce((acc, curr) => acc + Number(curr.remaining_amount || 0), 0);

      const netWorth = totalBalance - totalLiabilities;

      return NextResponse.json({
        success: true,
        result: {
          net_worth: netWorth,
          total_bank_balance: totalBalance,
          total_incomes: totalIncomes,
          total_expenses: totalExpenses,
          total_liabilities: totalLiabilities,
          accounts_count: accountsArr?.length || 0,
          accounts: accountsArr?.map((a) => ({ name: a.name, type: a.type, balance: a.balance, currency: a.currency })),
        },
      });
    }

    if (name === "list_accounts") {
      const { data: accountsArr, error } = await supabase.from("accounts").select("*").eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({ success: true, result: accountsArr || [] });
    }

    if (name === "list_recent_transactions") {
      const type = args?.type || "all";
      const category = args?.category;
      const limit = Number(args?.limit || 20);

      let query = supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(limit);
      if (type !== "all") query = query.eq("type", type);
      if (category) query = query.ilike("category", `%${category}%`);

      const { data: transactionsArr, error } = await query;
      if (error) throw error;

      return NextResponse.json({ success: true, result: transactionsArr || [] });
    }

    if (name === "add_transaction") {
      const type = args?.type;
      const amount = Number(args?.amount);
      const description = args?.description;
      const category = args?.category;
      const accountInput = args?.account_name_or_id;

      if (!type || isNaN(amount) || amount <= 0 || !description || !category) {
        return NextResponse.json({ error: "Missing or invalid required fields: type, amount, description, category" }, { status: 400 });
      }

      let account: any = null;
      const { data: allAccounts } = await supabase.from("accounts").select("*").eq("user_id", user.id);

      if (allAccounts && allAccounts.length > 0) {
        if (accountInput) {
          account = allAccounts.find(
            (a) => a.id === accountInput || a.name.toLowerCase().includes(String(accountInput).toLowerCase())
          );
        }
        if (!account) account = allAccounts[0];
      }

      const accountId = account?.id || null;
      let newBalance = Number(account?.balance || 0);
      const oldBalance = newBalance;

      if (type === "expense") newBalance -= amount;
      else newBalance += amount;

      if (accountId) {
        await supabase.from("accounts").update({ balance: newBalance }).eq("id", accountId).eq("user_id", user.id);
      }

      const { data: newTx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          account_id: accountId,
          type,
          amount,
          description,
          category,
          date: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (txErr) throw txErr;

      if (type === "expense") {
        await supabase.from("expenses").insert({
          user_id: user.id,
          account_id: accountId,
          description,
          amount,
          category,
          date: new Date().toISOString(),
        });
      } else {
        await supabase.from("incomes").insert({
          user_id: user.id,
          account_id: accountId,
          description,
          amount,
          category,
          date: new Date().toISOString(),
        });
      }

      await supabase.from("ledger_logs").insert({
        user_id: user.id,
        account_id: accountId,
        account_name: account?.name || "General",
        action_type: type === "expense" ? "ADJUST_DOWN" : "ADJUST_UP",
        amount,
        previous_balance: oldBalance,
        new_balance: newBalance,
        details: `MCP Transaction: ${description} (${category})`,
        source_type: type,
      });


      return NextResponse.json({
        success: true,
        result: {
          message: `Logged ${type} of ₹${amount} for '${description}' under '${category}'.`,
          account_updated: account?.name || "N/A",
          old_balance: oldBalance,
          new_balance: newBalance,
          transaction: newTx,
        },
      });
    }

    if (name === "get_portfolio_summary") {
      const [{ data: stocks }, { data: mutualFunds }, { data: bonds }, { data: altAssets }] = await Promise.all([
        supabase.from("investments").select("*").eq("user_id", user.id),
        supabase.from("mutual_funds").select("*").eq("user_id", user.id),
        supabase.from("bonds").select("*").eq("user_id", user.id),
        supabase.from("alternative_assets").select("*").eq("user_id", user.id),
      ]);

      const stocksValue = (stocks || []).reduce((acc, curr) => acc + Number(curr.quantity || 0) * Number(curr.current_price || 0), 0);
      const mfValue = (mutualFunds || []).reduce((acc, curr) => acc + Number(curr.units || 0) * Number(curr.current_nav || 0), 0);
      const bondsValue = (bonds || []).reduce((acc, curr) => acc + Number(curr.current_value || 0), 0);
      const altAssetsValue = (altAssets || []).reduce((acc, curr) => acc + Number(curr.current_value || 0), 0);

      return NextResponse.json({
        success: true,
        result: {
          total_portfolio_value: stocksValue + mfValue + bondsValue + altAssetsValue,
          stocks: { count: stocks?.length || 0, total_value: stocksValue, items: stocks },
          mutual_funds: { count: mutualFunds?.length || 0, total_value: mfValue, items: mutualFunds },
          bonds: { count: bonds?.length || 0, total_value: bondsValue, items: bonds },
          alternative_assets: { count: altAssets?.length || 0, total_value: altAssetsValue, items: altAssets },
        },
      });
    }

    if (name === "search_ledger") {
      const queryStr = args?.query || "";
      const limit = Number(args?.limit || 20);

      let query = supabase.from("ledger_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);

      if (queryStr) {
        query = query.or(`details.ilike.%${queryStr}%,account_name.ilike.%${queryStr}%`);
      }

      const { data: logs, error } = await query;
      if (error) throw error;

      return NextResponse.json({ success: true, result: logs || [] });
    }

    return NextResponse.json({ error: `Unknown tool name: ${name}` }, { status: 400 });
  } catch (error: any) {
    console.error("MCP route error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while processing the request." }, { status: 500 });
  }
}

