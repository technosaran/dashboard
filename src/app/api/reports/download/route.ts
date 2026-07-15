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

    // 5. Fetch all multi-asset records directly from Supabase tables
    const { data: dbLiabilities } = await supabase.from("liabilities").select("*").eq("user_id", user.id);
    const { data: dbInvestments } = await supabase.from("investments").select("*").eq("user_id", user.id);
    const { data: dbMutualFunds } = await supabase.from("mutual_funds").select("*").eq("user_id", user.id);
    const { data: dbBonds } = await supabase.from("bonds").select("*").eq("user_id", user.id);
    const { data: dbAlternativeAssets } = await supabase.from("alternative_assets").select("*").eq("user_id", user.id);

    // ===================================================
    // 6. CALCULATE INR PORTFOLIO SUMMARIES (Strict Separation)
    // ===================================================
    let inrLiquidAssets = 0;
    const accountNameMap = new Map<string, string>();
    const accountCurrencyMap = new Map<string, string>();

    const mappedAccounts = (accounts || []).map((acc) => {
      const bal = Number(acc.balance) || 0;
      if (acc.id && acc.name) {
        accountNameMap.set(acc.id, acc.name);
      }
      if (acc.id && acc.currency) {
        accountCurrencyMap.set(acc.id, acc.currency);
      }
      if ((acc.currency || "INR") === "INR") {
        inrLiquidAssets += bal;
      }
      return {
        name: acc.name || "",
        type: acc.type || "",
        balance: String(acc.balance),
        currency: acc.currency || "INR",
      };
    });

    const inrLiabilitiesList = (dbLiabilities || []).map(l => ({
      name: l.name || "",
      category: l.category || "",
      total_amount: Number(l.total_amount) || 0,
      remaining_amount: Number(l.remaining_amount) || 0,
      interest_rate: Number(l.interest_rate) || 0,
      monthly_payment: Number(l.monthly_payment) || 0,
    }));
    const totalInrLiabilities = inrLiabilitiesList.reduce((sum, l) => sum + l.remaining_amount, 0);

    const inrStocksList = (dbInvestments || []).filter(inv => inv.type === "stock" && (inv.currency || "INR") === "INR").map(inv => ({
      symbol: inv.symbol || "",
      name: inv.name || "",
      quantity: Number(inv.quantity) || 0,
      buy_price: Number(inv.buy_price) || 0,
      current_price: Number(inv.current_price) || 0,
      value: (Number(inv.quantity) || 0) * (Number(inv.current_price) || 0),
    }));
    const totalInrStocks = inrStocksList.reduce((sum, s) => sum + s.value, 0);

    const inrMutualFundsList = (dbMutualFunds || []).map(mf => ({
      fund_name: mf.fund_name,
      category: mf.category || "",
      units: Number(mf.units) || 0,
      avg_nav: Number(mf.avg_nav) || 0,
      current_nav: Number(mf.current_nav) || 0,
      value: (Number(mf.units) || 0) * (Number(mf.current_nav) || 0),
    }));
    const totalInrMutualFunds = inrMutualFundsList.reduce((sum, mf) => sum + mf.value, 0);

    const inrBondsList = (dbBonds || []).map(b => ({
      bond_name: b.bond_name,
      issuer: b.issuer || "",
      quantity: Number(b.quantity) || 0,
      purchase_price: Number(b.purchase_price) || 0,
      current_price: Number(b.current_price) || 0,
      value: Number(b.current_value) || ((Number(b.quantity) || 0) * (Number(b.current_price) || 0)),
      coupon_rate: Number(b.coupon_rate) || 0,
    }));
    const totalInrBonds = inrBondsList.reduce((sum, b) => sum + b.value, 0);

    const inrAlternativeAssetsList = (dbAlternativeAssets || []).map(aa => ({
      name: aa.name,
      category: aa.category || "",
      purchase_price: Number(aa.purchase_price) || 0,
      current_value: Number(aa.current_value) || 0,
    }));
    const totalInrAlternativeAssets = inrAlternativeAssetsList.reduce((sum, aa) => sum + aa.current_value, 0);

    const totalInrAssets = inrLiquidAssets + totalInrStocks + totalInrMutualFunds + totalInrBonds + totalInrAlternativeAssets;
    const inrNetWorth = totalInrAssets - totalInrLiabilities;

    // ===================================================
    // 7. CALCULATE USD PORTFOLIO SUMMARIES (Strict Separation)
    // ===================================================
    let usdLiquidAssets = 0;
    (accounts || []).forEach(acc => {
      if (acc.currency === "USD") {
        usdLiquidAssets += Number(acc.balance) || 0;
      }
    });

    const usdStocksList = (dbInvestments || []).filter(inv => inv.type === "stock" && inv.currency === "USD").map(inv => ({
      symbol: inv.symbol || "",
      name: inv.name || "",
      quantity: Number(inv.quantity) || 0,
      buy_price: Number(inv.buy_price) || 0,
      current_price: Number(inv.current_price) || 0,
      value: (Number(inv.quantity) || 0) * (Number(inv.current_price) || 0),
    }));
    const totalUsdStocks = usdStocksList.reduce((sum, s) => sum + s.value, 0);

    const usdCryptoList = (dbInvestments || []).filter(inv => inv.type === "crypto").map(inv => ({
      symbol: inv.symbol || "",
      name: inv.name || "",
      quantity: Number(inv.quantity) || 0,
      buy_price: Number(inv.buy_price) || 0,
      current_price: Number(inv.current_price) || 0,
      value: (Number(inv.quantity) || 0) * (Number(inv.current_price) || 0),
    }));
    const totalUsdCrypto = usdCryptoList.reduce((sum, c) => sum + c.value, 0);

    const totalUsdAssets = usdLiquidAssets + totalUsdStocks + totalUsdCrypto;
    const usdNetWorth = totalUsdAssets; // Assumes USD liabilities are not active

    // ===================================================
    // 8. FETCH AND MAP TRANSACTIONS
    // ===================================================
    const pad = (n: number) => String(n).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${pad(month)}-01T00:00:00.000Z`;
    const endDate = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59.999Z`;

    const txns = await transactionRepo.findByDateRange(user.id, startDate, endDate);
    const sortedTxns = [...txns].sort((a, b) => {
      return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    });

    const mappedTxns = sortedTxns.map((t) => {
      const currency = t.account_id ? accountCurrencyMap.get(t.account_id) : "INR";
      return {
        date: t.date ? new Date(t.date).toISOString().split("T")[0] : "—",
        description: t.description || "",
        type: t.type || "",
        amount: String(t.amount),
        currency: currency || "INR",
        category: t.category || "",
        account_name: t.account_id ? accountNameMap.get(t.account_id) : "—",
      };
    });

    // 9. Render React PDF to stream
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
        inrStats: {
          netWorth: inrNetWorth,
          totalAssets: totalInrAssets,
          totalLiabilities: totalInrLiabilities,
          liquidAssets: inrLiquidAssets,
        },
        usdStats: {
          netWorth: usdNetWorth,
          totalAssets: totalUsdAssets,
          totalLiabilities: 0,
          liquidAssets: usdLiquidAssets,
        },
        accounts: mappedAccounts,
        transactions: mappedTxns,
        inrStocks: inrStocksList,
        inrMutualFunds: inrMutualFundsList,
        inrBonds: inrBondsList,
        inrAlternativeAssets: inrAlternativeAssetsList,
        inrLiabilities: inrLiabilitiesList,
        usdStocks: usdStocksList,
        usdCrypto: usdCryptoList,
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
