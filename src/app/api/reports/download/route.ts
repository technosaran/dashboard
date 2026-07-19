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
    // ===================================================
    // 8. FETCH AND MAP TRANSACTIONS & PARTICULARS FILTERING
    // ===================================================
    const pad = (n: number) => String(n).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");
    const startDate = customStart || `${year}-${pad(month)}-01T00:00:00.000Z`;
    const endDate = customEnd || `${year}-${pad(month)}-${pad(lastDay)}T23:59:59.999Z`;

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

    const modulesParam = searchParams.get("modules") || "all";
    const selectedModules = new Set(modulesParam.split(","));
    const hasModule = (m: string) => selectedModules.has("all") || selectedModules.has(m);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const statementPeriod = customStart && customEnd
      ? `${customStart.split("T")[0]} to ${customEnd.split("T")[0]}`
      : `${monthNames[month - 1]} ${year}`;
    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const filteredAccounts = hasModule("accounts") ? mappedAccounts : [];
    const filteredTxns = hasModule("transactions") ? mappedTxns : [];
    const filteredInrStocks = hasModule("stocks") ? inrStocksList : [];
    const filteredInrMutualFunds = hasModule("mutual_funds") ? inrMutualFundsList : [];
    const filteredInrBonds = hasModule("bonds") ? inrBondsList : [];
    const filteredInrAlternativeAssets = hasModule("alternative_assets") ? inrAlternativeAssetsList : [];
    const filteredInrLiabilities = hasModule("liabilities") ? inrLiabilitiesList : [];
    const filteredUsdStocks = hasModule("usd_portfolio") ? usdStocksList : [];
    const filteredUsdCrypto = hasModule("usd_portfolio") ? usdCryptoList : [];

    // Check if CSV format is requested
    if (searchParams.get("format") === "csv") {
      const csvRows: string[] = [];
      csvRows.push(`FINANCE OS DATA EXPORT (${statementPeriod})`);
      csvRows.push(`Generated For,${userName}`);
      csvRows.push("");

      if (hasModule("accounts")) {
        csvRows.push("--- BANK & CREDIT ACCOUNTS ---");
        csvRows.push("Account Name,Type,Currency,Balance");
        filteredAccounts.forEach(a => csvRows.push(`"${(a.name || "").replace(/"/g, '""')}","${a.type || ""}",${a.currency || "INR"},${a.balance || 0}`));
        csvRows.push("");
      }

      if (hasModule("transactions")) {
        csvRows.push("--- TRANSACTIONS & LEDGER ---");
        csvRows.push("Date,Description,Type,Category,Account,Amount,Currency");
        filteredTxns.forEach(t => csvRows.push(`"${t.date}","${(t.description || "").replace(/"/g, '""')}","${t.type || ""}","${(t.category || "").replace(/"/g, '""')}","${(t.account_name || "").replace(/"/g, '""')}",${t.amount},${t.currency}`));
        csvRows.push("");
      }

      if (hasModule("stocks")) {
        csvRows.push("--- STOCKS & EQUITY ---");
        csvRows.push("Symbol,Name,Quantity,Buy Price,Current Price,Value");
        filteredInrStocks.forEach(s => csvRows.push(`"${s.symbol || ""}","${(s.name || "").replace(/"/g, '""')}",${s.quantity},${s.buy_price},${s.current_price},${s.value}`));
        csvRows.push("");
      }

      if (hasModule("mutual_funds")) {
        csvRows.push("--- MUTUAL FUNDS ---");
        csvRows.push("Fund Name,Category,Units,Avg NAV,Current NAV,Value");
        filteredInrMutualFunds.forEach(m => csvRows.push(`"${(m.fund_name || "").replace(/"/g, '""')}","${m.category || ""}",${m.units},${m.avg_nav},${m.current_nav},${m.value}`));
        csvRows.push("");
      }

      if (hasModule("bonds")) {
        csvRows.push("--- BONDS & FIXED INCOME ---");
        csvRows.push("Bond Name,Issuer,Quantity,Purchase Price,Current Price,Value,Coupon Rate");
        filteredInrBonds.forEach(b => csvRows.push(`"${(b.bond_name || "").replace(/"/g, '""')}","${(b.issuer || "").replace(/"/g, '""')}",${b.quantity},${b.purchase_price},${b.current_price},${b.value},${b.coupon_rate}%`));
        csvRows.push("");
      }

      if (hasModule("alternative_assets")) {
        csvRows.push("--- ALTERNATIVE ASSETS ---");
        csvRows.push("Name,Category,Purchase Price,Current Value");
        filteredInrAlternativeAssets.forEach(a => csvRows.push(`"${(a.name || "").replace(/"/g, '""')}","${a.category || ""}",${a.purchase_price},${a.current_value}`));
        csvRows.push("");
      }

      if (hasModule("liabilities")) {
        csvRows.push("--- LIABILITIES & LOANS ---");
        csvRows.push("Name,Category,Total Amount,Remaining Amount,Interest Rate,Monthly Payment");
        filteredInrLiabilities.forEach(l => csvRows.push(`"${(l.name || "").replace(/"/g, '""')}","${l.category || ""}",${l.total_amount},${l.remaining_amount},${l.interest_rate}%,${l.monthly_payment}`));
        csvRows.push("");
      }

      const csvString = csvRows.join("\n");
      const filenamePeriod = statementPeriod.replace(/[^a-zA-Z0-9]/g, "-");
      return new Response(csvString, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="Finance-Data-Export-${filenamePeriod}.csv"`,
        },
      });
    }

    // 9. Render React PDF to stream
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
        accounts: filteredAccounts,
        transactions: filteredTxns,
        inrStocks: filteredInrStocks,
        inrMutualFunds: filteredInrMutualFunds,
        inrBonds: filteredInrBonds,
        inrAlternativeAssets: filteredInrAlternativeAssets,
        inrLiabilities: filteredInrLiabilities,
        usdStocks: filteredUsdStocks,
        usdCrypto: filteredUsdCrypto,
      }) as any
    );

    const filenamePeriod = statementPeriod.replace(/[^a-zA-Z0-9]/g, "-");
    return new Response(stream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Financial-Statement-${filenamePeriod}.pdf"`,
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
