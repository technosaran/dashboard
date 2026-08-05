import { CASParseResult, CASParsedItem } from "./types";

function cleanNumber(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
}

export function detectCASType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("cams") || lower.includes("computer age management")) return "CAMS CAS";
  if (lower.includes("kfintech") || lower.includes("karvy")) return "KFintech CAS";
  if (lower.includes("cdsl") || lower.includes("central depository")) return "CDSL CAS";
  if (lower.includes("nsdl") || lower.includes("national securities depository")) return "NSDL CAS";
  return "Generic CAS";
}

export function parseCASText(text: string): CASParseResult {
  const casType = detectCASType(text);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const items: CASParsedItem[] = [];
  let itemCounter = 1;
  let totalValuation = 0;

  let currentFolio = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Folio Number (e.g. Folio No: 1234567/89)
    const folioMatch = line.match(/folio\s*(no|number)?\s*[:.-]?\s*([a-z0-9/]+)/i);
    if (folioMatch) {
      currentFolio = folioMatch[2];
    }

    // Detect Mutual Fund Scheme lines
    // Example: "HDFC Top 100 Fund - Direct Plan - Growth 150.250 85.40 12831.35"
    const mfMatch = line.match(/(?:^|\s)([A-Za-z0-9&()\-\s]+?(?:fund|index|growth|direct|regular|plan))\s+([\d,]+(?:\.\d{2,4})?)\s+([\d,]+(?:\.\d{2,4})?)\s+([\d,]+(?:\.\d{2,4})?)/i);

    if (mfMatch) {
      const name = mfMatch[1].trim();
      const units = cleanNumber(mfMatch[2]);
      const nav = cleanNumber(mfMatch[3]);
      const val = cleanNumber(mfMatch[4]) || units * nav;

      if (units > 0 && nav > 0) {
        totalValuation += val;
        items.push({
          id: `cas-item-${itemCounter++}`,
          assetClass: "mutual_fund",
          name,
          folioNumber: currentFolio || undefined,
          unitsOrQuantity: units,
          currentNavOrPrice: nav,
          totalValuation: val,
          selected: true,
        });
      }
      continue;
    }

    // Detect Stock Holding lines (e.g. INE002A01018 RELIANCE INDUSTRIES LTD 100 2950.00 295000.00)
    const stockMatch = line.match(/(INE\w{9})\s+([A-Za-z0-9&\s.-]+?)\s+([\d,]+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i);
    if (stockMatch) {
      const isin = stockMatch[1];
      const name = stockMatch[2].trim();
      const qty = cleanNumber(stockMatch[3]);
      const price = cleanNumber(stockMatch[4]);
      const val = cleanNumber(stockMatch[5]) || qty * price;

      if (qty > 0 && price > 0) {
        totalValuation += val;
        items.push({
          id: `cas-item-${itemCounter++}`,
          assetClass: "stock",
          name,
          isin,
          unitsOrQuantity: qty,
          currentNavOrPrice: price,
          totalValuation: val,
          selected: true,
        });
      }
    }
  }

  return {
    success: true,
    casType,
    items,
    totalValuation,
  };
}
