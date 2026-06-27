/**
 * Centralized module name definitions.
 * Import this everywhere instead of using magic string literals.
 */
export const MODULE_KEYS = [
  "Income & Expenses",
  "Budget",
  "Investments",
  "Alt Assets",
  "Liabilities",
  "Goals",
  "Family Management",
  "Ledger",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Map internal module key to user-facing sidebar label */
export const MODULE_DISPLAY_LABELS: Record<ModuleKey, string> = {
  "Income & Expenses": "Income & Expenses",
  "Budget": "Budget",
  "Investments": "Investments",
  "Alt Assets": "Assets",
  "Liabilities": "Loans",
  "Goals": "Goals",
  "Family Management": "Family Management",
  "Ledger": "Ledger",
};
