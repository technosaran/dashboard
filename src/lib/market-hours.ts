/**
 * Indian Stock Market (NSE/BSE) Hours & Status Utility
 * Handles Trading Days (Mon-Fri), Market Hours (9:15 AM - 3:30 PM IST),
 * Pre-Open Sessions, NSE Trading Holidays, and Weekend Detection.
 */

export interface MarketStatusInfo {
  isOpen: boolean;
  isPreOpen: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  statusText: "LIVE MARKET" | "PRE-OPEN" | "MARKET CLOSED" | "WEEKEND" | "TRADING HOLIDAY";
  badgeColor: string; // Tailored HSL/Hex for Zerodha dark theme
  formattedTimeIST: string;
  nextSessionText: string;
}

// Major NSE/BSE Trading Holidays for 2026 (YYYY-MM-DD format in IST)
const NSE_HOLIDAYS_2026 = [
  "2026-01-26", // Republic Day
  "2026-03-03", // Holi
  "2026-04-03", // Good Friday
  "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
  "2026-05-01", // Maharashtra Day
  "2026-08-15", // Independence Day
  "2026-10-02", // Mahatma Gandhi Jayanti
  "2026-10-20", // Dussehra
  "2026-11-09", // Diwali Laxmi Pujan (Diwali Muhurat trading limited hours)
  "2026-11-10", // Diwali Balipratipada
  "2026-12-25", // Christmas
];

/**
 * Returns current Date components formatted in IST (Asia/Kolkata)
 */
export function getIndianTime(): { dateStr: string; dayOfWeek: number; hours: number; minutes: number; totalMinutes: number; formattedTime: string } {
  const now = new Date();
  
  // Format to IST string
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat("en-GB", options);
  const parts = formatter.formatToParts(now);

  const partMap: Record<string, string> = {};
  parts.forEach(p => { if (p.type !== "literal") partMap[p.type] = p.value; });

  const year = partMap.year || "2026";
  const month = partMap.month || "01";
  const day = partMap.day || "01";
  const hours = parseInt(partMap.hour || "0", 10);
  const minutes = parseInt(partMap.minute || "0", 10);
  const seconds = partMap.second || "00";

  const dateStr = `${year}-${month}-${day}`;

  // Get day of week in IST
  const istDate = new Date(`${dateStr}T${partMap.hour}:${partMap.minute}:${seconds}+05:30`);
  const dayOfWeek = istDate.getDay(); // 0 = Sunday, 6 = Saturday

  const totalMinutes = hours * 60 + minutes;
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds} IST`;

  return { dateStr, dayOfWeek, hours, minutes, totalMinutes, formattedTime };
}

/**
 * Calculates real-time Indian Stock Market status
 */
export function getIndianMarketStatus(): MarketStatusInfo {
  const ist = getIndianTime();

  const isWeekend = ist.dayOfWeek === 0 || ist.dayOfWeek === 6;
  const isHoliday = NSE_HOLIDAYS_2026.includes(ist.dateStr);

  const preOpenStart = 9 * 60; // 09:00 AM IST
  const marketStart = 9 * 60 + 15; // 09:15 AM IST
  const marketEnd = 15 * 60 + 30; // 03:30 PM IST

  const isPreOpen = !isWeekend && !isHoliday && ist.totalMinutes >= preOpenStart && ist.totalMinutes < marketStart;
  const isOpen = !isWeekend && !isHoliday && ist.totalMinutes >= marketStart && ist.totalMinutes < marketEnd;

  let statusText: MarketStatusInfo["statusText"] = "MARKET CLOSED";
  let badgeColor = "#FF5722"; // Red/Orange for closed
  let nextSessionText = "Next session opens at 09:15 AM IST";

  if (isWeekend) {
    statusText = "WEEKEND";
    badgeColor = "#848E9C";
    nextSessionText = "Market opens Monday at 09:15 AM IST";
  } else if (isHoliday) {
    statusText = "TRADING HOLIDAY";
    badgeColor = "#848E9C";
    nextSessionText = "Market holiday (NSE/BSE closed)";
  } else if (isPreOpen) {
    statusText = "PRE-OPEN";
    badgeColor = "#F0B90B";
    nextSessionText = "Live trading begins at 09:15 AM IST";
  } else if (isOpen) {
    statusText = "LIVE MARKET";
    badgeColor = "#41B883"; // Zerodha Emerald Green
    nextSessionText = "Market closes at 03:30 PM IST";
  } else {
    statusText = "MARKET CLOSED";
    badgeColor = "#FF5722";
    if (ist.totalMinutes >= marketEnd) {
      nextSessionText = "Market opens tomorrow at 09:15 AM IST";
    } else {
      nextSessionText = "Market opens today at 09:15 AM IST";
    }
  }

  return {
    isOpen,
    isPreOpen,
    isWeekend,
    isHoliday,
    statusText,
    badgeColor,
    formattedTimeIST: ist.formattedTime,
    nextSessionText,
  };
}
