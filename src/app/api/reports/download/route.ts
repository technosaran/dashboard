import React from "react";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase-server";
import FinancialStatementPDF from "@/components/reports/FinancialStatementPDF";
import { createAppContainer } from "@/lib/container";
import { AccountRepository } from "@/repositories/account-repository";
import { TransactionRepository } from "@/repositories/transaction-repository";

export async function GET(request: Request) {
  try {
    // 1. Authenticate user session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse query parameters for month and year
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "", 10) || (new Date().getMonth() + 1);
    const year = parseInt(searchParams.get("year") || "", 10) || new Date().getFullYear();

    // 3. Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    const userName = profile?.username || user.email?.split("@")[0] || "Client";

    // 4. Initialize DI Container and Repositories
    const container = createAppContainer(supabase);
    const accountRepo = container.resolve<AccountRepository>("accountRepo");
    const transactionRepo = container.resolve<TransactionRepository>("transactionRepo");

    // Fetch accounts and compute asset stats
    const accounts = await accountRepo.findAll({
      where: { user_id: user.id }
    });

    let totalAssets = 0;
    const accountNameMap = new Map<string, string>();
    
    const mappedAccounts = (accounts || []).map((acc) => {
      const bal = Number(acc.balance) || 0;
      totalAssets += bal;
      if (acc.id && acc.name) {
        accountNameMap.set(acc.id, acc.name);
      }
      return {
        name: acc.name || "",
        type: acc.type || "",
        balance: String(acc.balance),
        currency: acc.currency || "INR",
      };
    });

    // 5. Fetch liabilities to calculate total liabilities
    const { data: liabilities } = await supabase
      .from("liabilities")
      .select("remaining_amount")
      .eq("user_id", user.id);

    const totalLiabilities = (liabilities || []).reduce(
      (sum, l) => sum + (Number(l.remaining_amount) || 0),
      0
    );

    // 6. Fetch transactions for current period range using repositories
    const pad = (n: number) => String(n).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${pad(month)}-01T00:00:00.000Z`;
    const endDate = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59.999Z`;

    const txns = await transactionRepo.findByDateRange(user.id, startDate, endDate);
    // Sort ascending for chronological PDF statement representation
    const sortedTxns = [...txns].sort((a, b) => {
      return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    });

    const mappedTxns = sortedTxns.map((t) => ({
      date: t.date ? new Date(t.date).toISOString().split("T")[0] : "—",
      description: t.description || "",
      type: t.type || "",
      amount: String(t.amount),
      category: t.category || "",
      account_name: t.account_id ? accountNameMap.get(t.account_id) : undefined,
    }));

    // 7. Render React PDF to stream
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const statementPeriod = `${monthNames[month - 1]} ${year}`;
    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const stream = await renderToStream(
      React.createElement(FinancialStatementPDF, {
        statementPeriod,
        generatedAt,
        userName,
        stats: {
          netWorth: totalAssets - totalLiabilities,
          totalAssets,
          totalLiabilities,
        },
        accounts: mappedAccounts,
        transactions: mappedTxns,
      }) as any
    );

    return new Response(stream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Financial-Statement-${month}-${year}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating statement PDF:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
