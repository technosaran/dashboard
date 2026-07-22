import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  db: Database | undefined;
};

export function getDb() {
  if (globalForDb.db) {
    return globalForDb.db;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing environment variable: DATABASE_URL is required to initialize Drizzle.");
  }

  globalForDb.pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  globalForDb.db = drizzle(globalForDb.pool, { schema });
  return globalForDb.db;
}

export async function closeDb() {
  if (globalForDb.pool) {
    await globalForDb.pool.end();
  }
  globalForDb.pool = undefined;
  globalForDb.db = undefined;
}
