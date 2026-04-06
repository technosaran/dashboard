const DEFAULT_LOCALE = "en-IN";

export function formatCurrency(
  amount: number,
  currency = "USD",
  options: Intl.NumberFormatOptions = {}
) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toLocaleString(DEFAULT_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

export function formatDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {}
) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(date);
}
