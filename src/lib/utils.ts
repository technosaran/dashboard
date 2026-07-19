import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseToISODate(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim().length === 0) {
    return new Date().toISOString().split("T")[0];
  }
  
  const trimmed = dateStr.trim();
  
  // Try parsing YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Try parsing DD-MM-YYYY / MM-DD-YYYY or DD/MM/YYYY / MM/DD/YYYY
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    // If first part is 4 digits (YYYY-MM-DD or YYYY/MM/DD)
    if (parts[0].length === 4) {
      const p1 = Number(parts[1]);
      if (p1 > 12) {
        // YYYY-DD-MM (fallback swap)
        return `${parts[0]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // If third part is 4 or 2 digits (DD-MM-YYYY / DD-MM-YY or MM-DD-YYYY / MM-DD-YY)
    if (parts[2].length === 4 || parts[2].length === 2) {
      const yearStr = parts[2].length === 2 ? String(2000 + Number(parts[2])) : parts[2];
      const p0 = Number(parts[0]);
      const p1 = Number(parts[1]);
      if (p0 > 12) {
        // First part is day, second is month (DD-MM-YYYY / DD-MM-YY)
        return `${yearStr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (p1 > 12) {
        // Second part is day, first is month (MM-DD-YYYY / MM-DD-YY)
        return `${yearStr}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      } else {
        // Ambiguous (both <= 12), default to DD-MM-YYYY
        return `${yearStr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  // Fallback to standard JS Date parsing
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  } catch {}

  // Final fallback
  return new Date().toISOString().split("T")[0];
}

export function getCurrencySymbol(currency?: string | null): string {
  if (!currency) return "₹";
  return currency.toUpperCase() === "USD" ? "$" : "₹";
}

export function getTableHeaderClass(columnId?: string): string {
  if (!columnId) return "text-left [&_button]:mr-auto [&_button]:justify-start";
  const id = columnId.toLowerCase();
  
  if (
    id === "actions" || id === "action" ||
    id.includes("qty") || id.includes("quantity") || id.includes("units") || id.includes("lot") ||
    id.includes("price") || id.includes("cost") || id.includes("nav") || id.includes("ltp") || id.includes("rate") ||
    id.includes("val") || id.includes("amount") || id.includes("invest") || id.includes("balance") || id.includes("emi") || id.includes("turnover") ||
    id.includes("pnl") || id.includes("chg") || id.includes("return") || id.includes("coupon") || id.includes("apr") || id.includes("ytm") || id.includes("progress") || id.includes("inr") || id.includes("remaining") || id.includes("outstanding") || id.includes("target") || id.includes("paid")
  ) {
    return "text-right [&_button]:ml-auto [&_button]:justify-end";
  }
  
  if (id === "type" || id === "status" || id === "channel" || id.includes("frequency")) {
    return "text-center [&_button]:mx-auto [&_button]:justify-center";
  }

  return "text-left [&_button]:mr-auto [&_button]:justify-start";
}

export function getTableCellClass(columnId?: string): string {
  if (!columnId) return "text-left";
  const id = columnId.toLowerCase();
  
  if (
    id === "actions" || id === "action" ||
    id.includes("qty") || id.includes("quantity") || id.includes("units") || id.includes("lot") ||
    id.includes("price") || id.includes("cost") || id.includes("nav") || id.includes("ltp") || id.includes("rate") ||
    id.includes("val") || id.includes("amount") || id.includes("invest") || id.includes("balance") || id.includes("emi") || id.includes("turnover") ||
    id.includes("pnl") || id.includes("chg") || id.includes("return") || id.includes("coupon") || id.includes("apr") || id.includes("ytm") || id.includes("progress") || id.includes("inr") || id.includes("remaining") || id.includes("outstanding") || id.includes("target") || id.includes("paid")
  ) {
    return "text-right";
  }
  
  if (id === "type" || id === "status" || id === "channel" || id.includes("frequency")) {
    return "text-center";
  }

  return "text-left";
}

const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 85.0,
  EUR: 92.0,
  GBP: 108.0,
  AED: 23.1,
  SGD: 63.0,
  CAD: 61.5,
  AUD: 55.0,
  JPY: 0.55,
  INR: 1.0,
};

export async function getExchangeRate(baseCurrency: string, targetCurrency: string = "INR"): Promise<number> {
  const base = baseCurrency.toUpperCase().trim();
  const target = targetCurrency.toUpperCase().trim();
  if (base === target) return 1.0;
  
  if (target === "INR" && DEFAULT_EXCHANGE_RATES[base]) {
    return DEFAULT_EXCHANGE_RATES[base];
  }
  return 85.0; // Clean fallback for USD/general foreign currencies if unknown
}

