import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  const expectedSecret = process.env.MIGRATION_SECRET || process.env.CRON_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL environment variable is not configured" }, { status: 500 });
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "20260718210000_telegram_integration.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    logger.info("Executing Telegram migration SQL...");
    await client.query(sql);
    
    logger.info("Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    
    await client.end();

    return NextResponse.json({ success: true, message: "Telegram columns migration completed and API schema cache refreshed successfully!" });
  } catch (error: any) {
    console.error("Migration endpoint error:", error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
