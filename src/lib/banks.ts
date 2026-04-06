export type Bank = { name: string; logo: string };

// Logos from Clearbit / official CDNs — publicly accessible
export const BANKS: Bank[] = [
  { name: "State Bank of India",       logo: "https://logo.clearbit.com/sbi.co.in" },
  { name: "HDFC Bank",                 logo: "https://logo.clearbit.com/hdfcbank.com" },
  { name: "ICICI Bank",                logo: "https://logo.clearbit.com/icicibank.com" },
  { name: "Axis Bank",                 logo: "https://logo.clearbit.com/axisbank.com" },
  { name: "Kotak Mahindra Bank",       logo: "https://logo.clearbit.com/kotak.com" },
  { name: "Punjab National Bank",      logo: "https://logo.clearbit.com/pnbindia.in" },
  { name: "Bank of Baroda",            logo: "https://logo.clearbit.com/bankofbaroda.in" },
  { name: "Canara Bank",               logo: "https://logo.clearbit.com/canarabank.in" },
  { name: "Union Bank of India",       logo: "https://logo.clearbit.com/unionbankofindia.co.in" },
  { name: "IndusInd Bank",             logo: "https://logo.clearbit.com/indusind.com" },
  { name: "Yes Bank",                  logo: "https://logo.clearbit.com/yesbank.in" },
  { name: "IDFC First Bank",           logo: "https://logo.clearbit.com/idfcfirstbank.com" },
  { name: "Federal Bank",              logo: "https://logo.clearbit.com/federalbank.co.in" },
  { name: "South Indian Bank",         logo: "https://logo.clearbit.com/southindianbank.com" },
  { name: "Karnataka Bank",            logo: "https://logo.clearbit.com/karnatakabank.com" },
  { name: "RBL Bank",                  logo: "https://logo.clearbit.com/rblbank.com" },
  { name: "Bandhan Bank",              logo: "https://logo.clearbit.com/bandhanbank.com" },
  { name: "UCO Bank",                  logo: "https://logo.clearbit.com/ucobank.com" },
  { name: "Bank of India",             logo: "https://logo.clearbit.com/bankofindia.co.in" },
  { name: "Indian Bank",               logo: "https://logo.clearbit.com/indianbank.in" },
  { name: "PayTM Payments Bank",       logo: "https://logo.clearbit.com/paytm.com" },
  { name: "Airtel Payments Bank",      logo: "https://logo.clearbit.com/airtel.in" },
  { name: "Zerodha",                   logo: "https://logo.clearbit.com/zerodha.com" },
  { name: "Groww",                     logo: "https://logo.clearbit.com/groww.in" },
  { name: "Upstox",                    logo: "https://logo.clearbit.com/upstox.com" },
];

export function searchBanks(query: string): Bank[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return BANKS.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 6);
}
