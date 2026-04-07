export type Bank = { name: string; logo: string };

// Real bank logos from official sources and reliable CDNs
// Comprehensive list of Indian Banks and Financial Institutions with original logos
export const BANKS: Bank[] = [
  // Public Sector Banks
  { name: "State Bank of India (SBI)", logo: "https://vignette.wikia.nocookie.net/logopedia/images/e/e0/State_Bank_of_India_Logo.svg" },
  { name: "Punjab National Bank (PNB)", logo: "https://vignette.wikia.nocookie.net/logopedia/images/6/6c/Punjab_National_Bank_logo.svg" },
  { name: "Bank of Baroda (BOB)",      logo: "https://vignette.wikia.nocookie.net/logopedia/images/3/3d/Bank_of_Baroda_logo.svg" },
  { name: "Canara Bank",               logo: "https://vignette.wikia.nocookie.net/logopedia/images/0/0d/Canara_Bank_Logo.svg" },
  { name: "Union Bank of India",       logo: "https://vignette.wikia.nocookie.net/logopedia/images/0/05/Union_Bank_of_India_Logo.svg" },
  { name: "Bank of India (BOI)",       logo: "https://vignette.wikia.nocookie.net/logopedia/images/c/ca/Bank_of_India_logo.svg" },
  { name: "Indian Bank",               logo: "https://vignette.wikia.nocookie.net/logopedia/images/f/f0/Indian_Bank_logo.svg" },
  { name: "Central Bank of India (CBI)", logo: "https://vignette.wikia.nocookie.net/logopedia/images/7/7b/Central_Bank_of_India_logo.svg" },
  { name: "Indian Overseas Bank (IOB)", logo: "https://vignette.wikia.nocookie.net/logopedia/images/6/66/Indian_Overseas_Bank_logo.svg" },
  { name: "UCO Bank",                  logo: "https://vignette.wikia.nocookie.net/logopedia/images/7/7e/UCO_Bank_logo.svg" },
  { name: "Bank of Maharashtra (BOM)", logo: "https://vignette.wikia.nocookie.net/logopedia/images/3/3a/Bank_of_Maharashtra_logo.svg" },
  { name: "Punjab & Sind Bank (PSB)",  logo: "https://vignette.wikia.nocookie.net/logopedia/images/4/4b/Punjab_%26_Sind_Bank_logo.svg" },

  // Private Sector Banks
  { name: "HDFC Bank",                 logo: "https://vignette.wikia.nocookie.net/logopedia/images/4/4c/HDFC_Bank_logo.svg" },
  { name: "ICICI Bank",                logo: "https://vignette.wikia.nocookie.net/logopedia/images/0/0b/ICICI_Bank_Logo.svg" },
  { name: "Axis Bank",                 logo: "https://vignette.wikia.nocookie.net/logopedia/images/f/f6/Axis_Bank_logo.svg" },
  { name: "Kotak Mahindra Bank",       logo: "https://vignette.wikia.nocookie.net/logopedia/images/b/b3/KotakMahindraBank_Logo.svg" },
  { name: "IndusInd Bank",             logo: "https://vignette.wikia.nocookie.net/logopedia/images/b/b3/IndusInd_Bank_Logo.svg" },
  { name: "Yes Bank",                  logo: "https://vignette.wikia.nocookie.net/logopedia/images/6/6f/Yes_Bank_Logo.svg" },
  { name: "IDFC First Bank",           logo: "https://vignette.wikia.nocookie.net/logopedia/images/d/df/IDFC_FIRST_Bank_Logo.svg" },
  { name: "Federal Bank",              logo: "https://vignette.wikia.nocookie.net/logopedia/images/4/4b/Federal_Bank_Logo.svg" },
  { name: "South Indian Bank",         logo: "https://vignette.wikia.nocookie.net/logopedia/images/4/43/South_Indian_Bank_Logo.svg" },
  { name: "Karnataka Bank",            logo: "https://vignette.wikia.nocookie.net/logopedia/images/b/be/Karnataka_Bank_Logo.svg" },
  { name: "RBL Bank",                  logo: "https://vignette.wikia.nocookie.net/logopedia/images/f/f3/RBL_Bank_logo.svg" },
  { name: "Karur Vysya Bank",          logo: "https://vignette.wikia.nocookie.net/logopedia/images/5/5e/Karur_Vysya_Bank_Logo.svg" },
  { name: "Bandhan Bank",              logo: "https://vignette.wikia.nocookie.net/logopedia/images/8/83/Bandhan_Bank_logo.svg" },
  { name: "IDBI Bank",                 logo: "https://vignette.wikia.nocookie.net/logopedia/images/8/87/IDBI_Bank_logo.svg" },
  { name: "City Union Bank",           logo: "https://vignette.wikia.nocookie.net/logopedia/images/9/9e/City_Union_Bank_Logo.svg" },
  { name: "DCB Bank",                  logo: "https://vignette.wikia.nocookie.net/logopedia/images/c/cc/DCB_Bank_logo.svg" },
  { name: "Tamilnad Mercantile Bank",  logo: "https://vignette.wikia.nocookie.net/logopedia/images/b/b8/Tamilnad_Mercantile_Bank_logo.svg" },
  { name: "J&K Bank",                  logo: "https://vignette.wikia.nocookie.net/logopedia/images/f/fd/J%26K_Bank_logo.svg" },

  // Payments / Small Finance Banks
  { name: "PayTM Payments Bank",       logo: "https://logo.clearbit.com/paytm.com" },
  { name: "Airtel Payments Bank",      logo: "https://logo.clearbit.com/airtel.in" },
  { name: "AU Small Finance Bank",     logo: "https://vignette.wikia.nocookie.net/logopedia/images/e/e0/AU_Small_Finance_Bank_logo.svg" },
  { name: "Equitas Small Finance Bank",logo: "https://vignette.wikia.nocookie.net/logopedia/images/3/3b/Equitas_Small_Finance_Bank_logo.svg" },
  { name: "Ujjivan Small Finance Bank",logo: "https://vignette.wikia.nocookie.net/logopedia/images/4/4b/Ujjivan_Small_Finance_Bank_logo.svg" },
  { name: "India Post Payments Bank",  logo: "https://vignette.wikia.nocookie.net/logopedia/images/a/a2/India_Post_Payments_Bank_logo.svg" },
  { name: "Fino Payments Bank",        logo: "https://vignette.wikia.nocookie.net/logopedia/images/9/91/Fino_Payments_Bank_logo.svg" },
  { name: "Jio Payments Bank",         logo: "https://vignette.wikia.nocookie.net/logopedia/images/6/6a/Jio_Payments_Bank_Logo.svg" },

  // Investment / International
  { name: "Zerodha",                   logo: "https://logo.clearbit.com/zerodha.com" },
  { name: "Groww",                     logo: "https://logo.clearbit.com/groww.in" },
  { name: "Upstox",                    logo: "https://logo.clearbit.com/upstox.com" },
  { name: "DBS Bank",                  logo: "https://vignette.wikia.nocookie.net/logopedia/images/0/00/DBS_Bank-Logo.wine.svg" },
];

export function searchBanks(query: string): Bank[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return BANKS.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 6);
}
