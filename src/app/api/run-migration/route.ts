import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import logger from "@/lib/logger";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  const expectedSecret = process.env.MIGRATION_SECRET || process.env.CRON_SECRET;
  if (!expectedSecret || !secret || !timingSafeEqual(secret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL environment variable is not configured" }, { status: 500 });
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    const telegramMigrationPath = path.join(process.cwd(), "supabase", "migrations", "20260718210000_telegram_integration.sql");
    const geminiMigrationPath = path.join(process.cwd(), "supabase", "migrations", "20260725140000_gemini_integration.sql");

    if (fs.existsSync(telegramMigrationPath)) {
      const sql1 = fs.readFileSync(telegramMigrationPath, "utf8");
      logger.info("Executing Telegram migration SQL...");
      await client.query(sql1);
    }

    if (fs.existsSync(geminiMigrationPath)) {
      const sql2 = fs.readFileSync(geminiMigrationPath, "utf8");
      logger.info("Executing Gemini migration SQL...");
      await client.query(sql2);
    }

    const geminiTelegramCtxPath = path.join(process.cwd(), "supabase", "migrations", "20260726000000_add_gemini_key_to_telegram_context.sql");
    if (fs.existsSync(geminiTelegramCtxPath)) {
      const sql3 = fs.readFileSync(geminiTelegramCtxPath, "utf8");
      logger.info("Executing Gemini Telegram context migration SQL...");
      await client.query(sql3);
    }

    const zerodhaAccountMigrationPath = path.join(process.cwd(), "supabase", "migrations", "20260801000000_add_zerodha_funds_account.sql");
    if (fs.existsSync(zerodhaAccountMigrationPath)) {
      const sql4 = fs.readFileSync(zerodhaAccountMigrationPath, "utf8");
      logger.info("Executing Zerodha Funds account migration SQL...");
      await client.query(sql4);
    }

    const ledgerAmountTriggerPath = path.join(process.cwd(), "supabase", "migrations", "20260801120000_fix_ledger_amount_trigger.sql");
    if (fs.existsSync(ledgerAmountTriggerPath)) {
      const sql5 = fs.readFileSync(ledgerAmountTriggerPath, "utf8");
      logger.info("Executing Ledger Amount Trigger migration SQL...");
      await client.query(sql5);
    }
    
    logger.info("Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");

    return NextResponse.json({ success: true, message: "Migrations completed and API schema cache refreshed successfully!" });
  } catch (error: any) {
    logger.error("Migration endpoint error:", error);
    return NextResponse.json({ error: "Migration execution failed." }, { status: 500 });
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

