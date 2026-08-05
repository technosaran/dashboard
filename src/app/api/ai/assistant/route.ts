import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { callGeminiApi, parseTransactionWithGemini, askGeminiFinanceAssistant } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to check gemini_api_key preference
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const profileData = profile as any;

    // Check if user has explicitly disabled Gemini AI
    if (profileData?.gemini_enabled === false) {
      return NextResponse.json(
        { error: "Gemini AI is disabled in your settings. Enable it to use the AI assistant." },
        { status: 403 }
      );
    }

    const apiKey = profileData?.gemini_api_key || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured. Please set GEMINI_API_KEY in environment or Settings." },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }
    const { mode, prompt, contextSummary, text } = body;

    if (mode === "parse") {
      if (!text && !prompt) {
        return NextResponse.json({ error: "Text is required for parse mode" }, { status: 400 });
      }
      const parsed = await parseTransactionWithGemini(text || prompt || "", apiKey);
      return NextResponse.json({ success: true, data: parsed });
    }

    if (mode === "insights") {
      // Fetch user's financial overview to feed Gemini
      const { data: overview } = await supabase.rpc("get_finance_overview_v2");

      // Format as structured plain-text instead of truncated JSON
      const ov = overview || {} as any;
      const summaryText = [
        `Net Worth: ₹${ov.net_worth ?? 'N/A'}`,
        `Total Income: ₹${ov.total_income ?? 'N/A'}`,
        `Total Expenses: ₹${ov.total_expenses ?? 'N/A'}`,
        `Savings Rate: ${ov.savings_rate ?? 'N/A'}%`,
        `Top Expense Category: ${ov.top_expense_category ?? 'N/A'}`,
        `Investment Value: ₹${ov.investment_value ?? 'N/A'}`,
      ].join('\n');

      const insightPrompt = `Provide a 3-bullet-point financial summary for this user:
- Bullet 1: Top spending category observation & advice
- Bullet 2: Net worth & savings progress encouragement
- Bullet 3: Actionable financial tip for this week
Keep it concise, friendly, and empowering.`;

      const response = await callGeminiApi(apiKey, insightPrompt, `User Financial Summary Data:\n${summaryText}`);
      return NextResponse.json({ success: true, answer: response });
    }

    // Default mode: "chat"
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const answer = await askGeminiFinanceAssistant(prompt, contextSummary || "User Dashboard Context", apiKey);
    return NextResponse.json({ success: true, answer });
  } catch (error: any) {
    console.error("AI Assistant API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process AI request" },
      { status: 500 }
    );
  }
}
