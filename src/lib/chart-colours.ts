// Standard premium chart color palette for distinct visualization
export const CHART_COLOURS = [
  "#00D1FF", // Electric Blue
  "#FF006E", // Neon Pink
  "#8338EC", // Vivid Violet
  "#3A86FF", // Royal Blue
  "#FB5607", // Orange Pulse
  "#FFBE0B", // Amber Glow
  "#06D6A0", // Caribbean Green
  "#EF476F", // Rose Madder
  "#118AB2", // Blue Munsell
  "#073B4C", // Midnight Green
  "#7209B7", // Purple Heart
  "#4CC9F0", // Sky Blue
  "#F72585", // Neon Rose
] as const;

// Category-specific colors for expenses - using a diverse premium palette
const CATEGORY_COLOURS: Record<string, string> = {
  "Food & Dining": "#FF006E",
  "Transportation": "#00D1FF",
  "Shopping": "#8338EC",
  "Entertainment": "#FFBE0B",
  "Bills & Utilities": "#3A86FF",
  "Healthcare": "#06D6A0",
  "Education": "#FB5607",
  "Travel": "#EF476F",
  "Groceries": "#118AB2",
  "Personal Care": "#4CC9F0",
  "Investment": "#7209B7",
  "Others": "#94A3B8",
} as const;

export function getCategoryColour(category: string): string {
  // Try exact match
  if (CATEGORY_COLOURS[category]) return CATEGORY_COLOURS[category];
  
  // Try case-insensitive and partial match for robustness
  const lowerCat = category.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_COLOURS)) {
    if (lowerCat.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerCat)) {
      return value;
    }
  }
  
  return CATEGORY_COLOURS["Others"];
}
