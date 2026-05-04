export type Bank = { name: string; domain: string };

// Bank registry mapping names to their official domains
// Used for logo resolution via multiple logo APIs
const BANKS: Bank[] = [
  // Major Public Sector Banks
  { name: "State Bank of India (SBI)",  domain: "sbi.co.in" },
  { name: "Punjab National Bank (PNB)", domain: "pnbindia.in" },
  { name: "Bank of Baroda (BOB)",       domain: "bankofbaroda.in" },
  { name: "Canara Bank",                domain: "canarabank.com" },
  { name: "Union Bank of India",        domain: "unionbankofindia.co.in" },
  { name: "Bank of India (BOI)",        domain: "bankofindia.co.in" },
  { name: "Indian Bank",                domain: "indianbank.in" },
  { name: "Central Bank of India",      domain: "centralbankofindia.co.in" },
  { name: "Indian Overseas Bank",       domain: "iob.in" },
  { name: "UCO Bank",                   domain: "ucobank.com" },
  { name: "Bank of Maharashtra",        domain: "bankofmaharashtra.in" },
  { name: "Punjab & Sind Bank",         domain: "punjabandsindbank.co.in" },

  // Major Private Sector Banks
  { name: "HDFC Bank",                  domain: "hdfcbank.com" },
  { name: "ICICI Bank",                 domain: "icicibank.com" },
  { name: "Axis Bank",                  domain: "axisbank.com" },
  { name: "Kotak Mahindra Bank",        domain: "kotak.com" },
  { name: "IndusInd Bank",              domain: "indusind.com" },
  { name: "Yes Bank",                   domain: "yesbank.in" },
  { name: "IDFC First Bank",            domain: "idfcfirstbank.com" },
  { name: "Federal Bank",               domain: "federalbank.co.in" },
  { name: "South Indian Bank",          domain: "southindianbank.com" },
  { name: "Karnataka Bank",             domain: "karnatakabank.com" },
  { name: "RBL Bank",                   domain: "rblbank.com" },
  { name: "Karur Vysya Bank",           domain: "kvb.co.in" },
  { name: "Bandhan Bank",               domain: "bandhanbank.com" },
  { name: "IDBI Bank",                  domain: "idbibank.in" },
  { name: "City Union Bank",            domain: "cityunionbank.com" },
  { name: "DCB Bank",                   domain: "dcbbank.com" },
  { name: "Tamilnad Mercantile Bank",   domain: "tmb.in" },
  { name: "J&K Bank",                   domain: "jkbank.com" },
  { name: "CSB Bank",                   domain: "csb.co.in" },
  { name: "Dhanlaxmi Bank",             domain: "dhanbank.com" },

  // International Banks (India Operations)
  { name: "HSBC India",                 domain: "hsbc.co.in" },
  { name: "Standard Chartered",         domain: "sc.com" },
  { name: "Citibank India",             domain: "citibank.co.in" },
  { name: "DBS Bank India",             domain: "dbs.com" },
  { name: "Deutsche Bank India",        domain: "db.com" },
  { name: "Barclays India",             domain: "barclays.com" },
  { name: "J.P. Morgan India",          domain: "jpmorgan.com" },

  // Small Finance & Payments Banks
  { name: "AU Small Finance Bank",      domain: "aubank.in" },
  { name: "Equitas Small Finance Bank", domain: "equitasbank.com" },
  { name: "Ujjivan Small Finance Bank", domain: "ujjivansfb.in" },
  { name: "ESAF Small Finance Bank",    domain: "esafbank.com" },
  { name: "Suryoday Small Finance Bank",domain: "suryodaybank.com" },
  { name: "Jana Small Finance Bank",    domain: "janabank.com" },
  { name: "Utkarsh Small Finance Bank", domain: "utkarshbank.in" },
  { name: "Capital Small Finance Bank", domain: "capitalbank.co.in" },
  { name: "Paytm Payments Bank",        domain: "paytm.com" },
  { name: "Airtel Payments Bank",       domain: "airtel.in" },
  { name: "Jio Payments Bank",          domain: "jio.com" },
  { name: "India Post Payments Bank",   domain: "ippbonline.com" },
  { name: "Fino Payments Bank",         domain: "finobank.com" },
  { name: "NSDL Payments Bank",         domain: "nsdlbank.com" },

  // Neo-Banks & Fintech
  { name: "Jupiter",                    domain: "jupiter.money" },
  { name: "Fi Money",                   domain: "fi.money" },
  { name: "Niyo",                       domain: "goniyo.com" },
  { name: "Slice",                      domain: "sliceit.com" },
  { name: "Uni Cards",                  domain: "uni.cards" },
  { name: "OneCard",                    domain: "getonecard.com" },
  { name: "FamPay",                     domain: "fampay.in" },
  { name: "Mobikwik",                   domain: "mobikwik.com" },
  { name: "PhonePe",                    domain: "phonepe.com" },
  { name: "Google Pay",                 domain: "pay.google.com" },
  { name: "Amazon Pay",                 domain: "amazon.in" },
  { name: "CRED",                       domain: "cred.club" },
  { name: "BharatPe",                   domain: "bharatpe.com" },
  { name: "Navi",                       domain: "navi.com" },

  // Investment Platforms
  { name: "Zerodha",                    domain: "zerodha.com" },
  { name: "Upstox",                     domain: "upstox.com" },
  { name: "Groww",                      domain: "groww.in" },
  { name: "Angel One",                  domain: "angelone.in" },
  { name: "Kuvera",                     domain: "kuvera.in" },
  { name: "Indmoney",                   domain: "indmoney.com" },
  { name: "ET Money",                   domain: "etmoney.com" },
  { name: "Smallcase",                  domain: "smallcase.com" },
  { name: "Wealthy",                    domain: "wealthy.in" },
  { name: "Paytm Money",               domain: "paytmmoney.com" },
  { name: "Coin by Zerodha",            domain: "zerodha.com" },
];

/**
 * Get the domain registered for a bank name
 */
export function getBankDomain(bankName: string): string | null {
  const bank = BANKS.find((b) => b.name.toLowerCase() === bankName.toLowerCase());
  return bank?.domain || null;
}



export function searchBanks(query: string): Bank[] {
  if (!query.trim()) return BANKS.slice(0, 15); // Show popular banks by default
  const q = query.toLowerCase();
  
  // Sort by priority and match quality
  return BANKS.filter((b) => {
    const name = b.name.toLowerCase();
    return name.includes(q) || q.includes(name.split(' ')[0]);
  })
  .sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
    if (!aName.startsWith(q) && bName.startsWith(q)) return 1;
    return 0;
  })
  .slice(0, 12);
}
