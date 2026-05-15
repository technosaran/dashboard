/**
 * Centralized module name definitions.
 * Import this everywhere instead of using magic string literals.
 */
export const MODULE_KEYS = [
  "Income",
  "Expenses",
  "Budget",
  "Stocks",
  "Mutual Funds",
  "Alt Assets",
  "Bonds",
  "Liabilities",
  "Goals",
  "Family",
  "Forex",
  "Ledger",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Map internal module key to user-facing sidebar label */
export const MODULE_DISPLAY_LABELS: Record<ModuleKey, string> = {
  "Income": "Income",
  "Expenses": "Expenses",
  "Budget": "Budget",
  "Stocks": "Stocks",
  "Mutual Funds": "Mutual Funds",
  "Alt Assets": "Assets",
  "Bonds": "Bonds",
  "Liabilities": "Loans",
  "Goals": "Goals",
  "Family": "Family",
  "Forex": "Forex",
  "Ledger": "Ledger",
};
