/**
 * Centralized module name definitions.
 * Import this everywhere instead of using magic string literals.
 */
export const MODULE_KEYS = [
  "Income & Expenses",
  "Budget",
  "Investments",
  "Tax & Reports",
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
  "Tax & Reports": "Tax",
  "Alt Assets": "Assets",
  "Liabilities": "Loans",
  "Goals": "Goals",
  "Family Management": "Family Management",
  "Ledger": "Ledger",
};

export function getCanonicalEnabledModules(rawEnabledModules?: string[] | null): string[] {
  if (!rawEnabledModules || !Array.isArray(rawEnabledModules) || rawEnabledModules.length === 0) {
    return [
      ...MODULE_KEYS,
      "Income",
      "Expenses",
      "Stocks",
      "Mutual Funds",
      "Bonds",
      "FnO",
      "Forex",
      "Crypto",
      "Tax",
      "Assets",
      "Loans",
      "Family",
    ];
  }

  const result = new Set<string>();
  for (const m of rawEnabledModules) {
    if ((MODULE_KEYS as readonly string[]).includes(m as any)) {
      result.add(m);
    }
    if (m === "Income & Expenses" || m === "Income" || m === "Expenses") {
      result.add("Income & Expenses");
      result.add("Income");
      result.add("Expenses");
    }
    if (m === "Investments" || ["Stocks", "Mutual Funds", "Bonds", "FnO", "Forex", "Crypto"].includes(m)) {
      result.add("Investments");
      result.add("Stocks");
      result.add("Mutual Funds");
      result.add("Bonds");
      result.add("FnO");
      result.add("Forex");
      result.add("Crypto");
    }
    if (m === "Tax & Reports" || m === "Tax") {
      result.add("Tax & Reports");
      result.add("Tax");
    }
    if (m === "Alt Assets" || m === "Assets") {
      result.add("Alt Assets");
      result.add("Assets");
    }
    if (m === "Liabilities" || m === "Loans") {
      result.add("Liabilities");
      result.add("Loans");
    }
    if (m === "Family Management" || m === "Family") {
      result.add("Family Management");
      result.add("Family");
    }
  }

  return Array.from(result);
}

export function isModuleEnabled(rawEnabledModules: string[] | null | undefined, key: ModuleKey): boolean {
  const enabled = getCanonicalEnabledModules(rawEnabledModules);
  return enabled.includes(key);
}

