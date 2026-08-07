import { NextRequest, NextResponse } from "next/server";
import { autoSyncTaxRulesFromAnnouncement } from "@/lib/tax/tax-rule-manager";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const announcementText = body.announcementText || `
      Union Budget 2026 Tax Announcement:
      New Tax Regime Slabs for FY 2026-27:
      Income up to ₹4,50,000: Nil tax.
      ₹4,50,001 to ₹9,00,000: 5% tax.
      ₹9,00,001 to ₹13,00,000: 10% tax.
      ₹13,00,001 to ₹17,00,000: 15% tax.
      ₹17,00,001 to ₹21,00,000: 20% tax.
      ₹21,00,001 to ₹25,00,000: 25% tax.
      Above ₹25,00,000: 30% tax.
      Standard Deduction under New Regime increased to ₹85,000.
      Section 87A rebate limit threshold updated to ₹13,00,000.
      STCG rate under Section 111A is 20%. LTCG rate under Section 112A is 12.5% with ₹1,25,000 exemption.
    `;

    // Get Gemini API key
    const { data: profile } = await supabase
      .from("profiles")
      .select("gemini_api_key, gemini_enabled")
      .eq("id", user.id)
      .maybeSingle();

    const apiKey = (profile as any)?.gemini_api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: "Gemini AI API key is not configured. Please set your API key in Settings -> Integrations."
      }, { status: 400 });
    }

    const result = await autoSyncTaxRulesFromAnnouncement(announcementText, apiKey);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to auto-sync tax rules" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `AI Auto-Sync Complete! Updated Tax Laws for ${result.rule?.version} (FY ${result.rule?.fyStartYear}-${String((result.rule?.fyStartYear || 0) + 1).slice(2)}).`,
      rule: result.rule,
      summary: result.summary,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to auto-sync tax rules" }, { status: 500 });
  }
}
