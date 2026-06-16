import { useMemo } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { USD_INR_EXCHANGE_RATE } from "@/lib/constants";

export function useNetWorth() {
  const { data } = useFinanceData();
  const {
    accounts,
    investments,
    forexAccounts,
    mutualFunds,
    bonds,
    alternativeAssets,
    liabilities,
  } = data;

  return useMemo(() => {
    // 1. Absolute INR calculations (excluding USD accounts/investments)
    const cashBalanceINR = accounts.reduce((sum, acc) => {
      const balance = Number(acc.balance || 0);
      return sum + (acc.currency !== 'USD' ? balance : 0);
    }, 0);
    const stockBalanceINR = investments.reduce((sum, inv) => {
      const value = Number(inv.quantity || 0) * Number(inv.current_price || 0);
      return sum + (inv.currency !== 'USD' ? value : 0);
    }, 0);

    // 2. Absolute USD calculations (USD accounts/investments only)
    const cashBalanceUSD = accounts.reduce((sum, acc) => {
      const balance = Number(acc.balance || 0);
      return sum + (acc.currency === 'USD' ? balance : 0);
    }, 0);
    const stockBalanceUSD = investments.reduce((sum, inv) => {
      const value = Number(inv.quantity || 0) * Number(inv.current_price || 0);
      return sum + (inv.currency === 'USD' ? value : 0);
    }, 0);

    // 3. Forex balances
    const forexBalanceINR = forexAccounts.reduce((sum, acc) => {
      const balance = Number(acc.balance || 0);
      return sum + (acc.currency !== 'USD' ? balance : 0);
    }, 0);
    const forexBalanceUSD = forexAccounts.reduce((sum, acc) => {
      const balance = Number(acc.balance || 0);
      return sum + (acc.currency === 'USD' ? balance : 0);
    }, 0);

    // 4. Auto-exchanged calculations for legacy compatibility
    const cashBalance = cashBalanceINR + (cashBalanceUSD * USD_INR_EXCHANGE_RATE);
    const stockBalance = stockBalanceINR + (stockBalanceUSD * USD_INR_EXCHANGE_RATE);
    const forexBalance = forexBalanceINR + (forexBalanceUSD * USD_INR_EXCHANGE_RATE);
    
    const mfBalance = mutualFunds.reduce((sum, mf) => sum + (Number(mf.units) * Number(mf.current_nav || 0)), 0);
    const bondBalance = (bonds || []).filter(b => b.status === 'Active').reduce((sum, b) => sum + Number(b.current_value || 0), 0);
    
    const altBalance = (alternativeAssets || []).reduce((sum, asset) => sum + Number(asset.current_value || 0), 0);
    const debtBalance = (liabilities || []).reduce((sum, debt) => sum + Number(debt.remaining_amount || 0), 0);
    
    const liquidBalance = cashBalance + stockBalance + mfBalance + bondBalance + forexBalance;
    const totalAssets = liquidBalance + altBalance;
    const netWorth = totalAssets - debtBalance;

    // Calculate consolidated Net Worth metrics in different currencies
    const totalAssetsINR = totalAssets;
    const netWorthINR = netWorth;
    const netWorthUSD = netWorth / USD_INR_EXCHANGE_RATE;

    return {
      netWorth,
      netWorthINR,
      netWorthUSD,
      cashBalance,
      cashBalanceINR,
      cashBalanceUSD,
      stockBalance,
      stockBalanceINR,
      stockBalanceUSD,
      forexBalance,
      forexBalanceINR,
      forexBalanceUSD,
      mfBalance,
      bondBalance,
      altBalance,
      debtBalance,
      liquidBalance,
      totalAssets,
      totalAssetsINR
    };
  }, [accounts, investments, forexAccounts, mutualFunds, bonds, alternativeAssets, liabilities]);
}
