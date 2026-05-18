export const CHART_COLOURS = [
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#8B5CF6", // Violet
  "#22C55E", // Emerald
  "#EC4899", // Pink
  "#EAB308", // Amber
  "#3B82F6", // Blue
  "#F43F5E", // Rose
  "#14B8A6", // Teal
  "#84CC16", // Lime
  "#6366F1", // Indigo
  "#FB7185", // Coral
] as const;

export const CHART_SERIES_COLOURS = {
  expense: "#F97316",
  expenseSoft: "#FB923C",
  income: "#10B981",
  incomeSoft: "#34D399",
  comparisonExpense: "#F43F5E",
} as const;

const CATEGORY_COLOURS = {
  "Food & Dining": "#F59E0B",
  Transportation: "#06B6D4",
  Shopping: "#EC4899",
  Entertainment: "#8B5CF6",
  "Bills & Utilities": "#6366F1",
  Rent: "#F97316",
  Utilities: "#EAB308",
  Healthcare: "#22C55E",
  Education: "#14B8A6",
  Travel: "#3B82F6",
  Groceries: "#84CC16",
  "Personal Care": "#FB7185",
  Investment: "#A855F7",
  Subscription: "#F43F5E",
  Others: "#94A3B8",
} as const;

type CategoryName = keyof typeof CATEGORY_COLOURS;

const CATEGORY_ALIASES: Record<string, CategoryName> = {
  food: "Food & Dining",
  dining: "Food & Dining",
  grocery: "Groceries",
  groceries: "Groceries",
  transport: "Transportation",
  transportation: "Transportation",
  rent: "Rent",
  utility: "Utilities",
  utilities: "Utilities",
  bills: "Bills & Utilities",
  healthcare: "Healthcare",
  health: "Healthcare",
  education: "Education",
  travel: "Travel",
  shopping: "Shopping",
  entertainment: "Entertainment",
  investment: "Investment",
  subscription: "Subscription",
  personal: "Personal Care",
  others: "Others",
  other: "Others",
};

export function getChartColour(index: number): string {
  return CHART_COLOURS[((index % CHART_COLOURS.length) + CHART_COLOURS.length) % CHART_COLOURS.length];
}

export function getCategoryColour(category: string): string {
  const normalized = category.trim().toLowerCase();

  if (!normalized) return CATEGORY_COLOURS.Others;

  const directMatch = Object.entries(CATEGORY_COLOURS).find(([key]) => key.toLowerCase() === normalized);
  if (directMatch) return directMatch[1];

  const aliasMatch = CATEGORY_ALIASES[normalized];
  if (aliasMatch) return CATEGORY_COLOURS[aliasMatch];

  const partialMatch = Object.entries(CATEGORY_ALIASES).find(([key]) => normalized.includes(key) || key.includes(normalized));
  if (partialMatch) return CATEGORY_COLOURS[partialMatch[1]];

  return CATEGORY_COLOURS.Others;
}
