import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | null = null;
let db: Database | null = null;

export function getDb() {
  if (db) {
    return db;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing environment variable: DATABASE_URL is required to initialize Drizzle.");
  }

  pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });
  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
  }
  pool = null;
  db = null;
}
