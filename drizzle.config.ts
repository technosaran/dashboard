import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required for Drizzle Kit migrations.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
