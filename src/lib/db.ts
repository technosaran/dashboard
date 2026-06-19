import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "@/db/schema";

const connectionString = process.env.DATABASE_URL || "";

const client = new Client({
  connectionString,
});

export const db = drizzle(client, { schema });
