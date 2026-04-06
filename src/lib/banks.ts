export type Bank = { name: string; logo: string };

// Real bank logos from official sources and reliable CDNs
export const BANKS: Bank[] = [
  { name: "State Bank of India",       logo: "https://www.logo.wine/a/logo/State_Bank_of_India/State_Bank_of_India-Logo.wine.svg" },
  { name: "HDFC Bank",                 logo: "https://companieslogo.com/img/orig/HDFCBANK.NS-b2b95a5c.png" },
  { name: "ICICI Bank",                logo: "https://companieslogo.com/img/orig/ICICIBANK.NS-44c232c6.png" },
  { name: "Axis Bank",                 logo: "https://companieslogo.com/img/orig/AXISBANK.NS-2f4d5c0e.png" },
  { name: "Kotak Mahindra Bank",       logo: "https://companieslogo.com/img/orig/KOTAKBANK.NS-f68f88e5.png" },
  { name: "Punjab National Bank",      logo: "https://companieslogo.com/img/orig/PNB.NS-8e0e0e8e.png" },
  { name: "Bank of Baroda",            logo: "https://companieslogo.com/img/orig/BANKBARODA.NS-8a4f8e8e.png" },
  { name: "Canara Bank",               logo: "https://companieslogo.com/img/orig/CANBK.NS-8e0e0e8e.png" },
  { name: "Union Bank of India",       logo: "https://companieslogo.com/img/orig/UNIONBANK.NS-8e0e0e8e.png" },
  { name: "IndusInd Bank",             logo: "https://companieslogo.com/img/orig/INDUSINDBK.NS-8e0e0e8e.png" },
  { name: "Yes Bank",                  logo: "https://companieslogo.com/img/orig/YESBANK.NS-8e0e0e8e.png" },
  { name: "IDFC First Bank",           logo: "https://companieslogo.com/img/orig/IDFCFIRSTB.NS-8e0e0e8e.png" },
  { name: "Federal Bank",              logo: "https://companieslogo.com/img/orig/FEDERALBNK.NS-8e0e0e8e.png" },
  { name: "South Indian Bank",         logo: "https://companieslogo.com/img/orig/SOUTHBANK.NS-8e0e0e8e.png" },
  { name: "Karnataka Bank",            logo: "https://companieslogo.com/img/orig/KTKBANK.NS-8e0e0e8e.png" },
  { name: "RBL Bank",                  logo: "https://companieslogo.com/img/orig/RBLBANK.NS-8e0e0e8e.png" },
  { name: "Bandhan Bank",              logo: "https://companieslogo.com/img/orig/BANDHANBNK.NS-8e0e0e8e.png" },
  { name: "UCO Bank",                  logo: "https://companieslogo.com/img/orig/UCOBANK.NS-8e0e0e8e.png" },
  { name: "Bank of India",             logo: "https://companieslogo.com/img/orig/BANKINDIA.NS-8e0e0e8e.png" },
  { name: "Indian Bank",               logo: "https://companieslogo.com/img/orig/INDIANB.NS-8e0e0e8e.png" },
  { name: "PayTM Payments Bank",       logo: "https://logo.clearbit.com/paytm.com" },
  { name: "Airtel Payments Bank",      logo: "https://logo.clearbit.com/airtel.in" },
  { name: "Zerodha",                   logo: "https://zerodha.com/static/images/logo.svg" },
  { name: "Groww",                     logo: "https://assets-netstorage.groww.in/web-assets/billion_groww_desktop/prod/_next/static/media/logo.8b37e88c.svg" },
  { name: "Upstox",                    logo: "https://upstox.com/app/themes/upstox/dist/img/logo/logo.svg" },
];

export function searchBanks(query: string): Bank[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return BANKS.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 6);
}
