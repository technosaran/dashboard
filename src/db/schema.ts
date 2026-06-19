import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  username: text("username"),
  settings: text("settings"), // Stores JSON string of enabled modules, etc.
  created_at: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  balance: numeric("balance").default("0").notNull(),
  currency: text("currency").default("INR").notNull(),
  bank_name: text("bank_name"),
  broker_name: text("broker_name"),
  created_at: timestamp("created_at").defaultNow(),
});
