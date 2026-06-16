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
    // If third part is 4 digits (DD-MM-YYYY or MM-DD-YYYY)
    if (parts[2].length === 4) {
      const p0 = Number(parts[0]);
      const p1 = Number(parts[1]);
      if (p0 > 12) {
        // First part is day, second is month (DD-MM-YYYY)
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (p1 > 12) {
        // Second part is day, first is month (MM-DD-YYYY)
        return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      } else {
        // Ambiguous (both <= 12), default to DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
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

