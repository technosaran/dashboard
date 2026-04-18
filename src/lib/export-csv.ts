/**
 * CSV Export Utility
 * Converts data arrays to CSV format and triggers browser download
 */

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: { key: keyof T; label: string }[]
): void {
  if (data.length === 0) {
    throw new Error("No data to export");
  }

  // Create CSV header
  const headers = columns.map(col => col.label).join(",");

  // Create CSV rows
  const rows = data.map(row => {
    return columns
      .map(col => {
        const value = row[col.key];
        // Handle different data types
        if (value === null || value === undefined) return "";
        if (typeof value === "string") {
          // Escape quotes and wrap in quotes if contains comma/newline
          const escaped = value.replace(/"/g, '""');
          return escaped.includes(",") || escaped.includes("\n") ? `"${escaped}"` : escaped;
        }
        return String(value);
      })
      .join(",");
  });

  // Combine header and rows
  const csv = [headers, ...rows].join("\n");

  // Create blob and trigger download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
