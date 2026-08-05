import { BankType, ParsedTransaction, BankStatementParseResult } from "./types";
import { parseToISODate } from "@/lib/utils";

const CATEGORY_PATTERNS: Array<{ category: string; keywords: string[] }> = [
  { category: "Food & Dining", keywords: ["swiggy", "zomato", "mcdonalds", "dominos", "starbucks", "restaurant", "cafe", "dhabha", "eats", "bakery", "food", "dine"] },
  { category: "Groceries", keywords: ["blinkit", "zepto", "instamart", "bigbasket", "grofers", "dmart", "supermarket", "grocery", "kirana", "jiomart", "store"] },
  { category: "Shopping", keywords: ["amazon", "flipkart", "myntra", "meesho", "nykaa", "ajio", "tata cliq", "retail", "zara", "h&m", "decathlon", "trends"] },
  { category: "Transport", keywords: ["uber", "ola", "rapido", "namma metro", "irctc", "redbus", "makemytrip", "indigo", "fastag", "petrol", "fuel", "hpcl", "bpcl", "iocl", "shell"] },
  { category: "Utilities", keywords: ["bescom", "tata power", "airtel", "jio", "vi ", "vodafone", "broadband", "electricity", "water", "gas", "recharge", "bill"] },
  { category: "Entertainment", keywords: ["netflix", "spotify", "prime video", "bookmyshow", "hotstar", "youtube", "playstation", "steam", "cinema", "movie"] },
  { category: "Health & Medical", keywords: ["apollo", "pharmeasy", "1mg", "netmeds", "hospital", "clinic", "pharmacy", "medical", "lab", "diagnostic"] },
  { category: "Transfers", keywords: ["upi", "transfer", "neft", "rtgs", "imps", "p2p", "paytm", "gpay", "phonepe"] },
  { category: "Salary & Business", keywords: ["salary", "payroll", "stipend", "reimbursement", "dividend", "interest credited", "by clg"] },
];

export function categorizeTransaction(description: string, type: "expense" | "income"): string {
  const descLower = description.toLowerCase();

  if (type === "income") {
    if (descLower.includes("salary") || descLower.includes("payroll")) return "Salary";
    if (descLower.includes("interest")) return "Interest Income";
    if (descLower.includes("dividend")) return "Dividend";
    if (descLower.includes("cashback") || descLower.includes("reward")) return "Cashback & Rewards";
    if (descLower.includes("refund")) return "Refund";
    return "Other Income";
  }

  for (const item of CATEGORY_PATTERNS) {
    if (item.keywords.some((kw) => descLower.includes(kw))) {
      return item.category;
    }
  }

  return "General Expense";
}

function cleanAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.abs(val);
}

export function cleanDescription(raw: string, defaultBankName: string = "Bank"): string {
  if (!raw) return `${defaultBankName.toUpperCase()} Transaction`;

  const cleaned = raw
    .replace(/<<.*?>>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\/(Subtype|Form|Filter|FlateDecode|Type|XObject|Matrix|Resources|BBox|Length|Contents|Group|Transparency|DeviceRGB|ColorSpace|Font|ProcSet|Page)\b[^/]*\b/gi, "")
    .replace(/stream|endstream|obj|endobj/gi, "")
    .replace(/[<>{}[\]\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !cleaned ||
    cleaned.length < 2 ||
    cleaned.toLowerCase().includes("xobject") ||
    cleaned.toLowerCase().includes("flatedecode") ||
    cleaned.toLowerCase().includes("subtype")
  ) {
    return `${defaultBankName.toUpperCase()} Transaction`;
  }

  return cleaned;
}

function normalizeDate(raw: string): string {
  try {
    const cleaned = raw.trim().replace(/[/.]/g, "-");
    const parts = cleaned.split(/\s+|-/);
    if (parts.length >= 3) {
      let day = parts[0];
      let month = parts[1];
      let year = parts[2];
      if (year.length === 2) year = `20${year}`;

      const monthNames: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
        january: "01", february: "02", march: "03", april: "04", june: "06",
        july: "07", august: "08", september: "09", october: "10", november: "11", december: "12"
      };

      if (isNaN(Number(month)) && monthNames[month.toLowerCase()]) {
        month = monthNames[month.toLowerCase()];
      }

      if (day.length === 1) day = `0${day}`;
      if (month.length === 1) month = `0${month}`;

      // Check for ISO format (YYYY-MM-DD) before swapping
      if (day.length === 4 && Number(day) > 1900) {
        // ISO format: parts[0]=YYYY, parts[1]=MM, parts[2]=DD
        const isoYear = day;
        const isoDay = year;
        day = isoDay;
        year = isoYear;
      } else if (Number(day) > 31 && Number(year) <= 31) {
        const tmp = day;
        day = year;
        year = tmp;
      }

      const iso = `${year}-${month}-${day}`;
      if (!isNaN(new Date(iso).getTime())) return iso;
    }
  } catch {}
  return parseToISODate(raw);
}

export function detectBankType(text: string): BankType {
  const lower = text.toLowerCase();
  if (lower.includes("hdfc bank") || lower.includes("hdfcbank")) return "hdfc";
  if (lower.includes("icici bank") || lower.includes("icicibank")) return "icici";
  if (lower.includes("state bank of india") || lower.includes("sbi") || lower.includes("onlinesbi")) return "sbi";
  if (lower.includes("axis bank") || lower.includes("axisbank")) return "axis";
  return "generic";
}

// Universal RegEx for Dates across Indian Banks:
// Supports: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY, DD-MM-YY, DD-MMM-YYYY, DD MMM YYYY, YYYY-MM-DD
const UNIVERSAL_DATE_REGEX = /(?:\b|^)(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/.]\w{3,9}[-/.]\d{2,4}|\d{1,2}\s+\w{3,9}\s+\d{2,4}|\d{4}-\d{2}-\d{2})(?:\b|$)/i;

export function parseBankStatementText(text: string, forceBank?: BankType): BankStatementParseResult {
  const bankDetected = forceBank && forceBank !== "auto" ? forceBank : detectBankType(text);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const transactions: ParsedTransaction[] = [];
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let idCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(UNIVERSAL_DATE_REGEX);

    if (dateMatch) {
      const rawDate = dateMatch[1];
      const lineWithoutDate = line.replace(rawDate, "").trim();

      // Extract all numeric candidates in the line (e.g. 350.00, 12,500.00)
      const numMatches = lineWithoutDate.match(/([\d,]+(?:\.\d{1,2})?)/g);

      if (numMatches && numMatches.length > 0) {
        // Filter out small numbers like S.No or single digit ref numbers
        const validAmounts = numMatches
          .map(cleanAmount)
          .filter((val) => val > 0 && val < 100000000);

        if (validAmounts.length > 0) {
          // Smart amount selection:
          // In Indian bank statements, format is typically: [description] [amount] [Dr/Cr] [balance]
          // When Dr/Cr indicator is present with 2+ amounts, first = transaction amount, last = closing balance
          // Without Dr/Cr, use the first valid amount
          const mainAmount = validAmounts[0];

          const isCr = /cr|credit|\+|by\s+/i.test(lineWithoutDate);
          const isDr = /dr|debit|\-|to\s+/i.test(lineWithoutDate);

          let type: "expense" | "income" = "expense";
          if (isCr) type = "income";
          else if (isDr) type = "expense";
          else if (lineWithoutDate.toLowerCase().includes("credit") || lineWithoutDate.toLowerCase().includes("deposit")) {
            type = "income";
          }

          // Clean narration description
          const rawDesc = lineWithoutDate
            .replace(/([\d,]+(?:\.\d{1,2})?)/g, "")
            .replace(/cr|dr|c|d/gi, "")
            .replace(/\s+/g, " ")
            .trim();

          const description = cleanDescription(rawDesc, bankDetected);

          const category = categorizeTransaction(description, type);

          if (type === "income") totalDeposits += mainAmount;
          else totalWithdrawals += mainAmount;

          transactions.push({
            id: `stmt-tx-${idCounter++}`,
            date: normalizeDate(rawDate),
            description,
            type,
            amount: mainAmount,
            category,
            selected: true,
          });
        }
      }
    }
  }

  // Broad Secondary Scanner (if 0 transactions found via line scanner)
  if (transactions.length === 0) {
    const globalMatches = Array.from(text.matchAll(new RegExp(UNIVERSAL_DATE_REGEX, "g")));

    for (const match of globalMatches) {
      const idx = match.index || 0;
      const snippet = text.substring(idx, idx + 120).replace(/\n/g, " ");

      const nums = snippet.match(/([\d,]+\.\d{2})/g);
      if (nums && nums.length > 0) {
        const amt = cleanAmount(nums[0]);
        if (amt > 0) {
          const isCr = /cr|credit|\+/i.test(snippet);
          const type: "expense" | "income" = isCr ? "income" : "expense";
          const rawDesc = snippet
            .replace(UNIVERSAL_DATE_REGEX, "")
            .replace(/[\d,]+\.\d{2}/g, "")
            .trim()
            .substring(0, 60);

          const description = cleanDescription(rawDesc, bankDetected);

          transactions.push({
            id: `stmt-tx-${idCounter++}`,
            date: normalizeDate(match[1]),
            description,
            type,
            amount: amt,
            category: categorizeTransaction(description, type),
            selected: true,
          });
        }
      }
    }
  }

  return {
    success: true,
    bankDetected,
    transactions,
    totalDeposits,
    totalWithdrawals,
  };
}
