export type Bank = { name: string; logo: string };

// Real bank logos from official sources/clearbit for high reliability
export const BANKS: Bank[] = [
  // Major Public Sector Banks
  { name: "State Bank of India (SBI)", logo: "https://logo.clearbit.com/sbi.co.in" },
  { name: "Punjab National Bank (PNB)", logo: "https://logo.clearbit.com/pnbindia.in" },
  { name: "Bank of Baroda (BOB)",      logo: "https://logo.clearbit.com/bankofbaroda.in" },
  { name: "Canara Bank",               logo: "https://logo.clearbit.com/canarabank.com" },
  { name: "Union Bank of India",       logo: "https://logo.clearbit.com/unionbankofindia.co.in" },
  { name: "Bank of India (BOI)",       logo: "https://logo.clearbit.com/bankofindia.co.in" },
  { name: "Indian Bank",               logo: "https://logo.clearbit.com/indianbank.in" },
  { name: "Central Bank of India",     logo: "https://logo.clearbit.com/centralbankofindia.co.in" },
  { name: "Indian Overseas Bank",      logo: "https://logo.clearbit.com/iob.in" },
  { name: "UCO Bank",                  logo: "https://logo.clearbit.com/ucobank.com" },
  { name: "Bank of Maharashtra",       logo: "https://logo.clearbit.com/bankofmaharashtra.in" },
  { name: "Punjab & Sind Bank",        logo: "https://logo.clearbit.com/punjabandsindbank.co.in" },

  // Major Private Sector Banks
  { name: "HDFC Bank",                 logo: "https://logo.clearbit.com/hdfcbank.com" },
  { name: "ICICI Bank",                logo: "https://logo.clearbit.com/icicibank.com" },
  { name: "Axis Bank",                 logo: "https://logo.clearbit.com/axisbank.com" },
  { name: "Kotak Mahindra Bank",       logo: "https://logo.clearbit.com/kotak.com" },
  { name: "IndusInd Bank",             logo: "https://logo.clearbit.com/indusind.com" },
  { name: "Yes Bank",                  logo: "https://logo.clearbit.com/yesbank.in" },
  { name: "IDFC First Bank",           logo: "https://logo.clearbit.com/idfcfirstbank.com" },
  { name: "Federal Bank",              logo: "https://logo.clearbit.com/federalbank.co.in" },
  { name: "South Indian Bank",         logo: "https://logo.clearbit.com/southindianbank.com" },
  { name: "Karnataka Bank",            logo: "https://logo.clearbit.com/karnatakabank.com" },
  { name: "RBL Bank",                  logo: "https://logo.clearbit.com/rblbank.com" },
  { name: "Karur Vysya Bank",          logo: "https://logo.clearbit.com/kvb.co.in" },
  { name: "Bandhan Bank",              logo: "https://logo.clearbit.com/bandhanbank.com" },
  { name: "IDBI Bank",                 logo: "https://logo.clearbit.com/idbibank.in" },
  { name: "City Union Bank",           logo: "https://logo.clearbit.com/cityunionbank.com" },
  { name: "DCB Bank",                  logo: "https://logo.clearbit.com/dcbbank.com" },
  { name: "Tamilnad Mercantile Bank",  logo: "https://logo.clearbit.com/tmb.in" },
  { name: "J&K Bank",                  logo: "https://logo.clearbit.com/jkbank.com" },
  { name: "CSB Bank",                  logo: "https://logo.clearbit.com/csb.co.in" },
  { name: "Dhanlaxmi Bank",            logo: "https://logo.clearbit.com/dhanbank.com" },

  // International Banks (India Operations)
  { name: "HSBC India",                logo: "https://logo.clearbit.com/hsbc.com" },
  { name: "Standard Chartered",        logo: "https://logo.clearbit.com/sc.com" },
  { name: "Citibank India",            logo: "https://logo.clearbit.com/citi.com" },
  { name: "DBS Bank India",            logo: "https://logo.clearbit.com/dbs.com" },
  { name: "Deutsche Bank India",       logo: "https://logo.clearbit.com/db.com" },
  { name: "Barclays India",            logo: "https://logo.clearbit.com/barclays.com" },
  { name: "J.P. Morgan India",         logo: "https://logo.clearbit.com/jpmorgan.com" },

  // Small Finance & Payments Banks
  { name: "AU Small Finance Bank",     logo: "https://logo.clearbit.com/aubank.in" },
  { name: "Equitas Small Finance Bank",logo: "https://logo.clearbit.com/equitasbank.com" },
  { name: "Ujjivan Small Finance Bank",logo: "https://logo.clearbit.com/ujjivansfb.in" },
  { name: "ESAF Small Finance Bank",   logo: "https://logo.clearbit.com/esafbank.com" },
  { name: "Suryoday Small Finance Bank",logo: "https://logo.clearbit.com/suryodaybank.com" },
  { name: "Jana Small Finance Bank",   logo: "https://logo.clearbit.com/janabank.com" },
  { name: "Utkarsh Small Finance Bank",logo: "https://logo.clearbit.com/utkarshbank.in" },
  { name: "Capital Small Finance Bank",logo: "https://logo.clearbit.com/capitalbank.co.in" },
  { name: "PayTM Payments Bank",       logo: "https://logo.clearbit.com/paytm.com" },
  { name: "Airtel Payments Bank",      logo: "https://logo.clearbit.com/airtel.in" },
  { name: "Jio Payments Bank",         logo: "https://logo.clearbit.com/jio.com" },
  { name: "India Post Payments Bank",  logo: "https://logo.clearbit.com/ippbonline.com" },
  { name: "Fino Payments Bank",        logo: "https://logo.clearbit.com/finobank.com" },
  { name: "NSDL Payments Bank",        logo: "https://logo.clearbit.com/nsdlbank.com" },

  // Neo-Banks & Fintech
  { name: "Jupiter",                   logo: "https://logo.clearbit.com/jupiter.money" },
  { name: "Fi Money",                  logo: "https://logo.clearbit.com/fi.money" },
  { name: "Niyo",                      logo: "https://logo.clearbit.com/goniyo.com" },
  { name: "Slice",                     logo: "https://logo.clearbit.com/sliceit.com" },
  { name: "Uni Cards",                 logo: "https://logo.clearbit.com/uni.cards" },
  { name: "OneCard",                   logo: "https://logo.clearbit.com/getonecard.com" },
  { name: "FamPay",                    logo: "https://logo.clearbit.com/fampay.in" },
  { name: "Mobikwik",                  logo: "https://logo.clearbit.com/mobikwik.com" },
  { name: "PhonePe",                   logo: "https://logo.clearbit.com/phonepe.com" },
  { name: "Google Pay",                logo: "https://logo.clearbit.com/google.com" },
  { name: "Amazon Pay",                logo: "https://logo.clearbit.com/amazon.in" },

  // Investment Platforms
  { name: "Zerodha",                   logo: "https://logo.clearbit.com/zerodha.com" },
  { name: "Upstox",                    logo: "https://logo.clearbit.com/upstox.com" },
  { name: "Groww",                     logo: "https://logo.clearbit.com/groww.in" },
  { name: "Angel One",                 logo: "https://logo.clearbit.com/angelone.in" },
  { name: "Kuvera",                    logo: "https://logo.clearbit.com/kuvera.in" },
  { name: "Indmoney",                  logo: "https://logo.clearbit.com/indmoney.com" },
  { name: "ET Money",                  logo: "https://logo.clearbit.com/etmoney.com" },
  { name: "Smallcase",                 logo: "https://logo.clearbit.com/smallcase.com" },
  { name: "Wealthy",                   logo: "https://logo.clearbit.com/wealthy.in" },
];

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



