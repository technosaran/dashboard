/**
 * Native Google Gemini API integration for FinanceOS & Telegram Bot
 * Connects directly to Google Generative AI REST API with zero external npm dependencies.
 * Provides graceful fallback if API Key is missing, disabled, or fails.
 */

export interface GeminiParsedIntent {
  success: boolean;
  intentType: "expense" | "income" | "transfer" | "stock" | "mutual_fund" | "inquiry" | "unknown";
  amount: number | null;
  category: string;
  description: string;
  accountName: string | null;
  symbol?: string | null;
  quantity?: number | null;
  price?: number | null;
  fundName?: string | null;
  answer?: string;
  error?: string;
}

/**
 * Check if Gemini AI is enabled and configured for a user profile
 */
export function isGeminiActiveForProfile(profile: any): boolean {
  if (!profile) return false;
  if (profile.gemini_enabled === false) return false;
  const key = profile.gemini_api_key || process.env.GEMINI_API_KEY;
  return !!key && key.trim().length > 0;
}

/**
 * Get active Gemini API key for a profile (or process.env fallback)
 */
export function getGeminiApiKeyForProfile(profile: any): string | null {
  if (!profile || profile.gemini_enabled === false) return null;
  const key = profile.gemini_api_key || process.env.GEMINI_API_KEY;
  return key?.trim() || null;
}

export interface GeminiInlineData {
  mimeType: string;
  data: string; // Base64 encoded string
}

/**
 * Low-level caller for Google Gemini REST API (gemini-2.5-flash with fallback to gemini-2.0-flash and gemini-1.5-flash)
 * Supports text and multimodal inline data (images, voice/audio clips)
 */
export async function callGeminiApi(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  inlineData?: GeminiInlineData
): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error("Gemini API key is empty");
  }

  const parts: any[] = [];
  if (inlineData && inlineData.data) {
    parts.push({
      inline_data: {
        mime_type: inlineData.mimeType,
        data: inlineData.data,
      },
    });
  }
  parts.push({ text: prompt });

  const payload: any = {
    contents: [
      {
        parts,
      },
    ],
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  // Model fallback list for maximum reliability across API keys
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError = "";

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          return candidate;
        }
      } else {
        lastError = await res.text();
      }
    } catch (e: any) {
      lastError = e.message || String(e);
    }
  }

  throw new Error(`Gemini API call failed across models: ${lastError}`);
}

/**
 * Intelligent financial text parser powered by Gemini AI
 */
export async function parseTransactionWithGemini(
  text: string,
  apiKey: string
): Promise<GeminiParsedIntent> {
  try {
    const systemPrompt = `You are an expert financial AI parser for FinanceOS. Analyze user text (which may contain typos, slang, hinglish, stock purchases, or mutual fund investments) and extract structured JSON matching this EXACT TypeScript schema:
{
  "intentType": "expense" | "income" | "transfer" | "stock" | "mutual_fund" | "inquiry" | "unknown",
  "amount": number | null,
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Salary" | "Gift" | "Work" | "Investments" | "Other",
  "description": "Short clean description",
  "accountName": "bank/account name if explicitly mentioned or null",
  "symbol": "Stock ticker symbol (e.g. TATAMOTORS, RELIANCE, AAPL, TCS) if applicable or null",
  "quantity": number or null,
  "price": number or null,
  "fundName": "Name of mutual fund if applicable or null"
}
Only output raw JSON without markdown code blocks.`;

    const resultText = await callGeminiApi(apiKey, `Parse this financial text: "${text}"`, systemPrompt);
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText.replace(/```json/g, "").replace(/```/g, "").trim());

    return {
      success: true,
      intentType: parsed.intentType || "unknown",
      amount: typeof parsed.amount === "number" && parsed.amount > 0 ? parsed.amount : (parsed.quantity && parsed.price ? parsed.quantity * parsed.price : null),
      category: parsed.category || (parsed.intentType === "stock" || parsed.intentType === "mutual_fund" ? "Investments" : "Other"),
      description: parsed.description || text,
      accountName: parsed.accountName || null,
      symbol: parsed.symbol || null,
      quantity: typeof parsed.quantity === "number" ? parsed.quantity : null,
      price: typeof parsed.price === "number" ? parsed.price : null,
      fundName: parsed.fundName || null,
    };
  } catch (error: any) {
    return {
      success: false,
      intentType: "unknown",
      amount: null,
      category: "Other",
      description: text,
      accountName: null,
      error: error.message || "Failed to parse with Gemini",
    };
  }
}

export interface GeminiAutonomousDecision {
  action: "CREATE_ACCOUNT" | "DELETE_ACCOUNT" | "UPDATE_ACCOUNT" | "LOG_EXPENSE" | "LOG_INCOME" | "FAMILY_TRANSFER" | "ADD_FAMILY_MEMBER" | "BUY_STOCK" | "BUY_MUTUAL_FUND" | "TRANSFER_BETWEEN_ACCOUNTS" | "SET_BUDGET" | "CREATE_GOAL" | "CONTRIBUTE_GOAL" | "FINANCIAL_QUERY" | "GREETING" | "UNKNOWN";
  accountName?: string | null;
  accountType?: "checking" | "savings" | "credit" | "investment" | "cash" | null;
  initialBalance?: number | null;
  amount?: number | null;
  category?: string | null;
  description?: string | null;
  targetAccountName?: string | null;
  fromAccountName?: string | null;
  toAccountName?: string | null;
  familyMemberName?: string | null;
  familyRelationship?: string | null;
  newAccountName?: string | null;
  symbol?: string | null;
  quantity?: number | null;
  price?: number | null;
  fundName?: string | null;
  goalName?: string | null;
  targetAmount?: number | null;
  transcription?: string | null;
  replyMessage?: string | null;
  reasoning?: string | null;
}

export async function parseAutonomousTelegramIntent(
  text: string,
  userContext: string,
  apiKey: string,
  chatHistory?: string
): Promise<GeminiAutonomousDecision> {
  try {
    const historyBlock = chatHistory ? `\nRecent Conversation History:\n${chatHistory}\n` : "";
    const systemPrompt = `You are the Autonomous Financial AI Engine for FinanceOS & Telegram.
Analyze user natural language messages and autonomously decide what financial action to execute.

User's Live Financial Context (Accounts, Balances, Category Spending, Investments, Budgets, Family):
${userContext}
${historyBlock}
Respond ONLY with valid JSON matching this schema:
{
  "action": "CREATE_ACCOUNT" | "DELETE_ACCOUNT" | "UPDATE_ACCOUNT" | "LOG_EXPENSE" | "LOG_INCOME" | "FAMILY_TRANSFER" | "ADD_FAMILY_MEMBER" | "BUY_STOCK" | "BUY_MUTUAL_FUND" | "TRANSFER_BETWEEN_ACCOUNTS" | "SET_BUDGET" | "CREATE_GOAL" | "CONTRIBUTE_GOAL" | "FINANCIAL_QUERY" | "GREETING" | "UNKNOWN",
  "accountName": string or null (e.g. "SBI", "HDFC", "ICICI"),
  "accountType": "checking" | "savings" | "credit" | "investment" | "cash" or null,
  "initialBalance": number or null,
  "amount": number or null,
  "newAccountName": string or null (for UPDATE_ACCOUNT rename),
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Salary" | "Gift" | "Work" | "Investments" | "Other" or null,
  "description": string or null,
  "targetAccountName": string or null,
  "fromAccountName": string or null,
  "toAccountName": string or null,
  "familyMemberName": string or null,
  "familyRelationship": string or null (e.g. "Mother", "Father", "Sister", "Brother", "Spouse", "Friend"),
  "symbol": string or null,
  "quantity": number or null,
  "price": number or null,
  "fundName": string or null,
  "goalName": string or null,
  "targetAmount": number or null,
  "replyMessage": string or null,
  "reasoning": string or null
}

Action Selection Rules:
1. "CREATE_ACCOUNT": If user asks to create, add, or open a bank/account (e.g. "create account SBI", "add account HDFC 5000"). Extract accountName, accountType (default "checking"), initialBalance.
2. "DELETE_ACCOUNT": If user asks to delete, remove, or close an account (e.g. "delete sbi", "remove hdfc account", "close my icici"). Match accountName against existing accounts from context.
3. "UPDATE_ACCOUNT": If user asks to rename, change, or update an account (e.g. "rename SBI to SBI Salary"). Use accountName for current name and newAccountName for new name.
4. "LOG_EXPENSE": If user spent money (e.g. "500 Swiggy", "paid 1200 rent").
5. "LOG_INCOME": If user received money, income, salary, dividend, or credited funds into a bank (e.g. "income from Samsung 2 cr to ICICI", "50000 salary credited", "got 2000 refund"). NEVER classify income/credit into a bank as TRANSFER_BETWEEN_ACCOUNTS.
6. "ADD_FAMILY_MEMBER": If user wants to add a family member (e.g. "add family member Sri", "add mom"). Extract familyMemberName and familyRelationship.
7. "FAMILY_TRANSFER": If user transferred money to family (e.g. "sent 1000 to Mom").
8. "BUY_STOCK": If user bought stocks (e.g. "bought 10 shares of SBI at 800").
9. "BUY_MUTUAL_FUND": If user invested in mutual fund (e.g. "invested 5000 in Parag Parikh Flexi Cap").
10. "TRANSFER_BETWEEN_ACCOUNTS": ONLY if user explicitly moves funds between two existing accounts owned by user (e.g. "moved 5000 from HDFC to SBI", "transfer 1000 from SBI to ICICI").
11. "SET_BUDGET": If user wants to set or update a category budget (e.g. "set food budget 15000", "budget 5000 for transport"). Extract category and amount.
12. "CREATE_GOAL": If user wants to create a savings goal (e.g. "create goal Buy Car 500000", "goal iPhone 150000"). Extract goalName and targetAmount.
13. "CONTRIBUTE_GOAL": If user wants to add funds toward a goal (e.g. "contribute 5000 to Car goal", "save 2000 for iPhone"). Extract goalName and amount.
14. "FINANCIAL_QUERY": If user asked a question, for net worth, advice, top spending, budget check, or summary. Provide friendly concise markdown in "replyMessage".
15. "GREETING": If user sends a greeting like hi, hello, hey, good morning, etc. Set replyMessage to a friendly short greeting.

IMPORTANT: For DELETE_ACCOUNT, match the accountName the user mentions against the account names in the user's context. Use the exact account name from context.

Output raw JSON with no markdown tags.`;

    const resultText = await callGeminiApi(apiKey, `User message: "${text}"`, systemPrompt);
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText.replace(/```json/g, "").replace(/```/g, "").trim());

    return {
      action: parsed.action || "UNKNOWN",
      accountName: parsed.accountName || null,
      accountType: parsed.accountType || "checking",
      initialBalance: typeof parsed.initialBalance === "number" ? parsed.initialBalance : null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      category: parsed.category || null,
      description: parsed.description || null,
      targetAccountName: parsed.targetAccountName || null,
      fromAccountName: parsed.fromAccountName || null,
      toAccountName: parsed.toAccountName || null,
      familyMemberName: parsed.familyMemberName || null,
      symbol: parsed.symbol || null,
      quantity: typeof parsed.quantity === "number" ? parsed.quantity : null,
      price: typeof parsed.price === "number" ? parsed.price : null,
      fundName: parsed.fundName || null,
      replyMessage: parsed.replyMessage || null,
      familyRelationship: parsed.familyRelationship || null,
      newAccountName: parsed.newAccountName || null,
      reasoning: parsed.reasoning || null,
    };
  } catch (error: any) {
    return {
      action: "UNKNOWN",
      reasoning: error.message || "Failed to process autonomous intent",
    };
  }
}

/**
 * Transcribe and parse voice notes (audio messages) using Gemini Multimodal Audio API
 */
export async function parseVoiceNoteWithGemini(
  audioBase64: string,
  mimeType: string,
  userContext: string,
  apiKey: string,
  chatHistory?: string
): Promise<GeminiAutonomousDecision> {
  try {
    const historyBlock = chatHistory ? `\nRecent Conversation History:\n${chatHistory}\n` : "";
    const systemPrompt = `You are the Multimodal Voice & Audio Financial AI Engine for FinanceOS & Telegram.
Listen to the user's recorded voice note audio message.
1. Transcribe the audio accurately into text.
2. Determine the user's financial intent and decide what action to execute.

User's Live Financial Context:
${userContext}
${historyBlock}
Respond ONLY with valid JSON matching this schema:
{
  "transcription": "Exact spoken audio transcription text",
  "action": "CREATE_ACCOUNT" | "DELETE_ACCOUNT" | "UPDATE_ACCOUNT" | "LOG_EXPENSE" | "LOG_INCOME" | "FAMILY_TRANSFER" | "ADD_FAMILY_MEMBER" | "BUY_STOCK" | "BUY_MUTUAL_FUND" | "TRANSFER_BETWEEN_ACCOUNTS" | "FINANCIAL_QUERY" | "GREETING" | "UNKNOWN",
  "accountName": string or null,
  "accountType": "checking" | "savings" | "credit" | "investment" | "cash" or null,
  "initialBalance": number or null,
  "amount": number or null,
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Salary" | "Gift" | "Work" | "Investments" | "Other" or null,
  "description": string or null,
  "targetAccountName": string or null,
  "fromAccountName": string or null,
  "toAccountName": string or null,
  "familyMemberName": string or null,
  "symbol": string or null,
  "quantity": number or null,
  "price": number or null,
  "fundName": string or null,
  "replyMessage": string or null,
  "reasoning": string or null
}

Output raw JSON with no markdown tags.`;

    const resultText = await callGeminiApi(
      apiKey,
      "Transcribe audio and analyze financial intent from this voice note.",
      systemPrompt,
      { mimeType: mimeType || "audio/ogg", data: audioBase64 }
    );

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText.replace(/```json/g, "").replace(/```/g, "").trim());

    return {
      transcription: parsed.transcription || "Voice audio processed",
      action: parsed.action || "UNKNOWN",
      accountName: parsed.accountName || null,
      accountType: parsed.accountType || "checking",
      initialBalance: typeof parsed.initialBalance === "number" ? parsed.initialBalance : null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      category: parsed.category || null,
      description: parsed.description || parsed.transcription || null,
      targetAccountName: parsed.targetAccountName || null,
      fromAccountName: parsed.fromAccountName || null,
      toAccountName: parsed.toAccountName || null,
      familyMemberName: parsed.familyMemberName || null,
      symbol: parsed.symbol || null,
      quantity: typeof parsed.quantity === "number" ? parsed.quantity : null,
      price: typeof parsed.price === "number" ? parsed.price : null,
      fundName: parsed.fundName || null,
      replyMessage: parsed.replyMessage || null,
      reasoning: parsed.reasoning || null,
    };
  } catch (error: any) {
    return {
      action: "UNKNOWN",
      reasoning: error.message || "Failed to process voice note with Gemini",
    };
  }
}

/**
 * Scan photo receipts & bills using Gemini Vision Multimodal API (OCR + Extraction)
 */
export async function parseReceiptWithGemini(
  imageBase64: string,
  mimeType: string,
  userContext: string,
  apiKey: string
): Promise<{
  success: boolean;
  merchantName: string;
  amount: number | null;
  date: string | null;
  category: string;
  items: string[];
  description: string;
  accountName?: string | null;
  error?: string;
}> {
  try {
    const systemPrompt = `You are an expert Vision Financial Receipt Scanner for FinanceOS.
Analyze this photo receipt, invoice, or bill. Extract the key data and respond with raw JSON matching this schema:
{
  "merchantName": "Name of store / restaurant / vendor",
  "amount": total final amount paid as number (e.g. 450.50),
  "date": "YYYY-MM-DD" if present on receipt else null,
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Other",
  "items": ["list of main items purchased"],
  "description": "Short clean description summary of receipt",
  "accountName": "bank name if printed on payment slip else null"
}
Output raw JSON with no markdown tags.`;

    const resultText = await callGeminiApi(
      apiKey,
      "Analyze this receipt image and extract total amount, merchant, and items.",
      systemPrompt,
      { mimeType: mimeType || "image/jpeg", data: imageBase64 }
    );

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText.replace(/```json/g, "").replace(/```/g, "").trim());

    return {
      success: true,
      merchantName: parsed.merchantName || "Store Purchase",
      amount: typeof parsed.amount === "number" && parsed.amount > 0 ? parsed.amount : null,
      date: parsed.date || null,
      category: parsed.category || "Shopping",
      items: Array.isArray(parsed.items) ? parsed.items : [],
      description: parsed.description || `${parsed.merchantName || "Receipt"} Purchase`,
      accountName: parsed.accountName || null,
    };
  } catch (error: any) {
    return {
      success: false,
      merchantName: "Receipt",
      amount: null,
      date: null,
      category: "Other",
      items: [],
      description: "Receipt Scan Failed",
      error: error.message || "Failed to analyze receipt",
    };
  }
}

export async function askGeminiFinanceAssistant(
  query: string,
  contextSummary: string,
  apiKey: string,
  chatHistory?: string
): Promise<string> {
  const historyBlock = chatHistory ? `\nRecent Conversation History:\n${chatHistory}\n` : "";
  const systemPrompt = `You are the Lead Financial Advisor & AI Assistant for FinanceOS.
Your goal is to provide insightful, actionable, and beautifully formatted financial responses for Telegram and the Web Dashboard.

Formatting Guidelines for Telegram:
- Use clean Telegram Markdown (*bold* for key numbers, titles, metrics, and categories).
- Use relevant financial emojis (🟢 Income/Profit, 🔴 Expense/Loss, 💳 Bank/Account, 📊 Metrics, 🎯 Goals, 💡 Tips).
- Keep answers structured with bullet points or numbered steps.
- Highlight concrete figures from user context (e.g. *Net Worth*: ₹X, *Food Budget*: ₹Y).
- Conclude with a helpful, encouraging financial tip or actionable next step.

User's Live Financial Context:
${contextSummary}
${historyBlock}`;

  return await callGeminiApi(apiKey, query, systemPrompt);
}

export interface GeminiParsedTaxRules {
  success: boolean;
  fyStartYear: number;
  version: string;
  standardDeductionOld: number;
  standardDeductionNew: number;
  cessRate: number;
  stcgRate: number;
  ltcgRate: number;
  ltcgExemption: number;
  oldRegimeSlabs: Array<{ upto: number | null; rate: number }>;
  newRegimeSlabs: Array<{ upto: number | null; rate: number }>;
  deductionLimits: Record<string, number>;
  summary: string;
  error?: string;
}

export async function parseBudgetOrTaxAnnouncementWithGemini(
  budgetText: string,
  apiKey: string
): Promise<GeminiParsedTaxRules> {
  try {
    const systemPrompt = `You are an expert Income Tax Law & Union Budget AI Parser for FinanceOS.
Analyze the provided Union Budget speech, Finance Bill press release, or tax amendment text.
Extract the exact tax rules, slabs, deductions, and capital gains parameters for Indian Income Tax.

Respond ONLY with valid JSON matching this EXACT schema:
{
  "fyStartYear": number (e.g. 2026 for FY 2026-27),
  "version": "FY2026-27-v1",
  "standardDeductionOld": number (default 50000),
  "standardDeductionNew": number (default 75000),
  "cessRate": number (e.g. 0.04),
  "stcgRate": number (e.g. 0.20 for 20%),
  "ltcgRate": number (e.g. 0.125 for 12.5%),
  "ltcgExemption": number (e.g. 125000),
  "oldRegimeSlabs": [
    { "upto": 250000, "rate": 0 },
    { "upto": 500000, "rate": 0.05 },
    { "upto": 1000000, "rate": 0.2 },
    { "upto": null, "rate": 0.3 }
  ],
  "newRegimeSlabs": [
    { "upto": 400000, "rate": 0 },
    { "upto": 800000, "rate": 0.05 },
    { "upto": 1200000, "rate": 0.1 },
    { "upto": 1600000, "rate": 0.15 },
    { "upto": 2000000, "rate": 0.2 },
    { "upto": 2400000, "rate": 0.25 },
    { "upto": null, "rate": 0.3 }
  ],
  "deductionLimits": {
    "80C": 150000,
    "80D": 25000,
    "80CCD(1B)": 50000
  },
  "summary": "Brief clean summary of the parsed tax rule changes"
}

Output raw JSON only with no markdown formatting.`;

    const resultText = await callGeminiApi(
      apiKey,
      `Parse this tax notification / budget text: "${budgetText}"`,
      systemPrompt
    );

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText.replace(/```json/g, "").replace(/```/g, "").trim());

    return {
      success: true,
      fyStartYear: typeof parsed.fyStartYear === "number" ? parsed.fyStartYear : new Date().getFullYear(),
      version: parsed.version || `FY${parsed.fyStartYear || new Date().getFullYear()}-v1`,
      standardDeductionOld: typeof parsed.standardDeductionOld === "number" ? parsed.standardDeductionOld : 50000,
      standardDeductionNew: typeof parsed.standardDeductionNew === "number" ? parsed.standardDeductionNew : 75000,
      cessRate: typeof parsed.cessRate === "number" ? parsed.cessRate : 0.04,
      stcgRate: typeof parsed.stcgRate === "number" ? parsed.stcgRate : 0.20,
      ltcgRate: typeof parsed.ltcgRate === "number" ? parsed.ltcgRate : 0.125,
      ltcgExemption: typeof parsed.ltcgExemption === "number" ? parsed.ltcgExemption : 125000,
      oldRegimeSlabs: Array.isArray(parsed.oldRegimeSlabs) ? parsed.oldRegimeSlabs : [],
      newRegimeSlabs: Array.isArray(parsed.newRegimeSlabs) ? parsed.newRegimeSlabs : [],
      deductionLimits: parsed.deductionLimits || { "80C": 150000, "80D": 25000 },
      summary: parsed.summary || "Tax rules successfully updated",
    };
  } catch (error: any) {
    return {
      success: false,
      fyStartYear: new Date().getFullYear(),
      version: "Error",
      standardDeductionOld: 50000,
      standardDeductionNew: 75000,
      cessRate: 0.04,
      stcgRate: 0.20,
      ltcgRate: 0.125,
      ltcgExemption: 125000,
      oldRegimeSlabs: [],
      newRegimeSlabs: [],
      deductionLimits: {},
      summary: "Parsing failed",
      error: error.message || "Failed to parse tax announcement with Gemini AI",
    };
  }
}

