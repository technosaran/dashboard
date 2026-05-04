// Standard chart color palette for consistent visualization
export const CHART_COLOURS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#FFA07A", // Light Salmon
  "#98D8C8", // Mint
  "#F7DC6F", // Yellow
  "#BB8FCE", // Purple
  "#82E0AA", // Green
  "#F1948A", // Pink
  "#85C1E9", // Sky Blue
] as const;

// Category-specific colors for expenses
const CATEGORY_COLOURS: Record<string, string> = {
  "Food & Dining": "#FF6B6B",
  "Transportation": "#4ECDC4",
  "Shopping": "#45B7D1",
  "Entertainment": "#FFA07A",
  "Bills & Utilities": "#98D8C8",
  "Healthcare": "#F7DC6F",
  "Education": "#BB8FCE",
  "Travel": "#82E0AA",
  "Groceries": "#F1948A",
  "Personal Care": "#85C1E9",
  "Others": "#95A5A6",
} as const;

export function getCategoryColour(category: string): string {
  return CATEGORY_COLOURS[category] || CATEGORY_COLOURS["Others"];
}

