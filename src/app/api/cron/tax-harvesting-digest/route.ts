import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import logger from "@/lib/logger";
import { sendTelegramMessage } from "@/lib/telegram";
import { computeTaxLossHarvesting, TaxHarvestingItem } from "@/lib/tax/india-tax-engine";

export async function GET(req: NextRequest) {
  return handleTaxHarvestingDigest(req);
}

export async function POST(req: NextRequest) {
  return handleTaxHarvestingDigest(req);
}

async function handleTaxHarvestingDigest(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const secretParam = new URL(req.url).searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production" || expectedSecret) {
      const isAuthorized =
        expectedSecret &&
        (authHeader === `Bearer ${expectedSecret}` ||
          cronSecretHeader === expectedSecret ||
          secretParam === expectedSecret);
      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY configuration" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, telegram_chat_id, username, base_currency")
      .not("telegram_chat_id", "is", null);

    if (profErr || !profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, message: "No Telegram users for tax harvesting digest." });
    }

    let notifiedCount = 0;

    for (const profile of profiles) {
      if (!profile.telegram_chat_id) continue;

      const { data: investments } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", profile.id);

      if (!investments || investments.length === 0) continue;

      const { getCurrentFYStartYear } = await import("@/lib/tax/india-tax-engine");
      const taxInput: any = {
        fyStartYear: getCurrentFYStartYear(),
        regime: "new",
        incomes: [],
        expenses: [],
        investments,
        mutualFunds: [],
        bonds: [],
        alternativeAssets: [],
      };

      const harvestingResult = computeTaxLossHarvesting(taxInput);
      const currency = profile.base_currency || "INR";
      const formatCurr = (amt: number) =>
        new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(amt);

      if (harvestingResult.totalLossHarvestable <= 0 && harvestingResult.maxPotentialTaxSavings <= 0) {
        continue;
      }

      const msg =
        `📉 *Monthly Tax Loss Harvesting Opportunities* _(${profile.username || "Saran"})_\n\n` +
        `💡 *Tax Optimization Summary* (Finance Act 2025 Rules):\n` +
        `• *Harvestable Capital Losses*: ${formatCurr(harvestingResult.totalLossHarvestable)}\n` +
        `• *Max Potential Tax Savings*: *${formatCurr(harvestingResult.maxPotentialTaxSavings)}*\n\n` +
        `👉 *Action Plan*:\n` +
        `Harvesting under-performing positions can offset your taxable STCG (20%) & LTCG (12.5%) gains before March 31!\n\n` +
        `_Open your Web Dashboard Tax Studio to simulate position selling with 1-click._`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 Open Tax Loss Studio", url: "https://technosaranfin.vercel.app/dashboard/tax-reports" }
          ]
        ]
      };

      await sendTelegramMessage(profile.telegram_chat_id, msg, keyboard);
      notifiedCount++;
    }

    logger.info(`[Telegram Tax Digest] Sent monthly tax digest to ${notifiedCount} users.`);
    return NextResponse.json({ success: true, notified_users: notifiedCount });
  } catch (err: any) {
    logger.error("[Telegram Tax Digest Error]:", err);
    return NextResponse.json({ error: err.message || "Tax digest exception" }, { status: 500 });
  }
}
