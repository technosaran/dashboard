/**
 * Drizzle schema — used for migration generation via drizzle-kit ONLY.
 *
 * IMPORTANT: This schema is intentionally partial. The full database schema
 * lives in Supabase and is reflected in src/lib/database.types.ts (generated
 * by the Supabase CLI). Runtime data access goes through the Supabase client,
 * not through Drizzle's ORM query builder.
 *
 * To run migrations: set DATABASE_URL in .env.local, then run:
 *   npx drizzle-kit generate
 *   npx drizzle-kit push
 */

import { pgTable, uuid, text, numeric, timestamp, boolean, integer, jsonb, real } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  username: text("username"),
  base_currency: text("base_currency").default("INR").notNull(),
  theme: text("theme").default("dark").notNull(),
  timezone: text("timezone").default("Asia/Kolkata").notNull(),
  enabled_modules: jsonb("enabled_modules").default([]),
  default_accounts: jsonb("default_accounts").default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// accounts
// ---------------------------------------------------------------------------
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  balance: numeric("balance").default("0").notNull(),
  currency: text("currency").default("INR").notNull(),
  bank_name: text("bank_name"),
  institution: text("institution"),
  account_number: text("account_number"),
  color: text("color"),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// transactions
// ---------------------------------------------------------------------------
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  account_id: uuid("account_id").notNull(),
  type: text("type").notNull(),
  amount: numeric("amount").notNull(),
  description: text("description").notNull(),
  category: text("category"),
  date: timestamp("date").defaultNow().notNull(),
  source_type: text("source_type"),
  source_id: uuid("source_id"),
  ledger_log_id: uuid("ledger_log_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// transfers
// ---------------------------------------------------------------------------
export const transfers = pgTable("transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  from_account_id: uuid("from_account_id").notNull(),
  to_account_id: uuid("to_account_id").notNull(),
  amount: numeric("amount").notNull(),
  note: text("note"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// ledger_logs
// ---------------------------------------------------------------------------
export const ledgerLogs = pgTable("ledger_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  account_id: uuid("account_id"),
  account_name: text("account_name"),
  action_type: text("action_type").notNull(),
  amount: numeric("amount"),
  previous_balance: numeric("previous_balance"),
  new_balance: numeric("new_balance"),
  details: text("details"),
  source_type: text("source_type"),
  source_id: uuid("source_id"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// incomes
// ---------------------------------------------------------------------------
export const incomes = pgTable("incomes", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  account_id: uuid("account_id"),
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  category: text("category").notNull(),
  date: timestamp("date").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// expenses
// ---------------------------------------------------------------------------
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  account_id: uuid("account_id"),
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  category: text("category").notNull(),
  date: timestamp("date").defaultNow(),
  is_recurring: boolean("is_recurring").default(false),
  recurrence_frequency: text("recurrence_frequency"),
  recurrence_day: integer("recurrence_day"),
  recurrence_end_date: timestamp("recurrence_end_date"),
  last_generated_date: timestamp("last_generated_date"),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// budgets
// ---------------------------------------------------------------------------
export const budgets = pgTable("budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount").default("0").notNull(),
  period_month: integer("period_month").notNull(),
  period_year: integer("period_year").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// goals
// ---------------------------------------------------------------------------
export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  name: text("name").notNull(),
  target_amount: numeric("target_amount").default("0"),
  current_amount: numeric("current_amount").default("0"),
  deadline: timestamp("deadline"),
  category: text("category"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// liabilities
// ---------------------------------------------------------------------------
export const liabilities = pgTable("liabilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  total_amount: numeric("total_amount").default("0"),
  remaining_amount: numeric("remaining_amount").default("0"),
  interest_rate: numeric("interest_rate"),
  monthly_payment: numeric("monthly_payment"),
  due_date: timestamp("due_date"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// investments (stocks)
// ---------------------------------------------------------------------------
export const investments = pgTable("investments", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  symbol: text("symbol"),
  quantity: numeric("quantity").default("0"),
  buy_price: numeric("buy_price").default("0"),
  current_price: numeric("current_price").default("0"),
  previous_close: numeric("previous_close"),
  day_change: numeric("day_change"),
  day_change_percent: numeric("day_change_percent"),
  currency: text("currency").default("INR").notNull(),
  notes: text("notes"),
  bought_at: timestamp("bought_at"),
  realized_pnl: numeric("realized_pnl"),
  market_state: text("market_state"),
  last_fetch_at: timestamp("last_fetch_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// stock_trades
// ---------------------------------------------------------------------------
export const stockTrades = pgTable("stock_trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  investment_id: uuid("investment_id"),
  ledger_log_id: uuid("ledger_log_id"),
  symbol: text("symbol").notNull(),
  trade_type: text("trade_type").notNull(),
  quantity: numeric("quantity").notNull(),
  price: numeric("price").notNull(),
  total_amount: numeric("total_amount").notNull(),
  charges: numeric("charges"),
  realized_pnl: numeric("realized_pnl"),
  exchange: text("exchange"),
  trade_date: timestamp("trade_date").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// mutual_funds
// ---------------------------------------------------------------------------
export const mutualFunds = pgTable("mutual_funds", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  fund_name: text("fund_name").notNull(),
  fund_symbol: text("fund_symbol"),
  scheme_code: text("scheme_code"),
  amc_name: text("amc_name"),
  category: text("category"),
  investment_type: text("investment_type"),
  units: numeric("units").default("0"),
  avg_nav: numeric("avg_nav").default("0"),
  current_nav: numeric("current_nav").default("0"),
  previous_nav: numeric("previous_nav"),
  day_change: numeric("day_change"),
  day_change_percent: numeric("day_change_percent"),
  expense_ratio: numeric("expense_ratio"),
  realized_pnl: numeric("realized_pnl"),
  last_nav_updated_at: timestamp("last_nav_updated_at"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// mutual_fund_trades
// ---------------------------------------------------------------------------
export const mutualFundTrades = pgTable("mutual_fund_trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  mf_id: uuid("mf_id"),
  account_id: uuid("account_id"),
  ledger_log_id: uuid("ledger_log_id"),
  fund_name: text("fund_name").notNull(),
  trade_type: text("trade_type").notNull(),
  units: numeric("units").notNull(),
  nav: numeric("nav").notNull(),
  amount: numeric("amount").notNull(),
  stamp_duty: numeric("stamp_duty"),
  exit_load_details: text("exit_load_details"),
  realized_pnl: numeric("realized_pnl"),
  date: timestamp("date").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// bonds
// ---------------------------------------------------------------------------
export const bonds = pgTable("bonds", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  isin: text("isin").notNull(),
  bond_name: text("bond_name").notNull(),
  issuer: text("issuer").notNull(),
  bond_type: text("bond_type").notNull(),
  face_value: numeric("face_value").default("1000"),
  coupon_rate: numeric("coupon_rate").notNull(),
  purchase_price: numeric("purchase_price").notNull(),
  current_price: numeric("current_price").notNull(),
  quantity: numeric("quantity").default("1"),
  total_invested: numeric("total_invested").notNull(),
  current_value: numeric("current_value").notNull(),
  purchase_date: timestamp("purchase_date").notNull(),
  maturity_date: timestamp("maturity_date").notNull(),
  next_interest_date: timestamp("next_interest_date"),
  interest_frequency: text("interest_frequency"),
  credit_rating: text("credit_rating"),
  platform: text("platform"),
  demat_account: text("demat_account"),
  ytm: numeric("ytm"),
  accrued_interest: numeric("accrued_interest"),
  total_interest_earned: numeric("total_interest_earned"),
  status: text("status").default("Active"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// bond_transactions
// ---------------------------------------------------------------------------
export const bondTransactions = pgTable("bond_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  bond_id: uuid("bond_id"),
  account_id: uuid("account_id"),
  transaction_type: text("transaction_type").notNull(),
  amount: numeric("amount").notNull(),
  quantity: numeric("quantity"),
  price_per_bond: numeric("price_per_bond"),
  interest_amount: numeric("interest_amount"),
  interest_period_start: timestamp("interest_period_start"),
  interest_period_end: timestamp("interest_period_end"),
  notes: text("notes"),
  transaction_date: timestamp("transaction_date").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// alternative_assets
// ---------------------------------------------------------------------------
export const alternativeAssets = pgTable("alternative_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  purchase_price: numeric("purchase_price").default("0"),
  current_value: numeric("current_value").default("0"),
  purchase_date: timestamp("purchase_date"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// forex_accounts
// ---------------------------------------------------------------------------
export const forexAccounts = pgTable("forex_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  broker_name: text("broker_name").notNull(),
  account_label: text("account_label").notNull(),
  account_number: text("account_number"),
  balance: numeric("balance").default("0"),
  total_deposited: numeric("total_deposited").default("0"),
  total_withdrawn: numeric("total_withdrawn").default("0"),
  total_pnl: numeric("total_pnl").default("0"),
  currency: text("currency").default("USD"),
  status: text("status"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// forex_trades
// ---------------------------------------------------------------------------
export const forexTrades = pgTable("forex_trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  forex_account_id: uuid("forex_account_id").notNull(),
  pair: text("pair").notNull(),
  trade_type: text("trade_type").notNull(),
  lot_size: real("lot_size").notNull(),
  entry_price: numeric("entry_price"),
  exit_price: numeric("exit_price"),
  pnl: numeric("pnl").default("0"),
  status: text("status"),
  notes: text("notes"),
  trade_date: timestamp("trade_date").defaultNow().notNull(),
  close_date: timestamp("close_date"),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// forex_transactions
// ---------------------------------------------------------------------------
export const forexTransactions = pgTable("forex_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  forex_account_id: uuid("forex_account_id").notNull(),
  bank_account_id: uuid("bank_account_id"),
  transaction_type: text("transaction_type").notNull(),
  amount: numeric("amount").notNull(),
  notes: text("notes"),
  transaction_date: timestamp("transaction_date").defaultNow().notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// fno_trades (Futures & Options)
// ---------------------------------------------------------------------------
export const fnoTrades = pgTable("fno_trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  account_id: uuid("account_id"),
  ledger_log_id: uuid("ledger_log_id"),
  close_ledger_log_id: uuid("close_ledger_log_id"),
  symbol: text("symbol").notNull(),
  instrument_type: text("instrument_type").notNull(), // FUT | CE | PE
  strike_price: numeric("strike_price"),
  expiry_date: text("expiry_date").notNull(),
  trade_type: text("trade_type").notNull(), // BUY | SELL
  quantity: integer("quantity").notNull(),
  entry_price: numeric("entry_price").notNull(),
  exit_price: numeric("exit_price"),
  pnl: numeric("pnl"),
  status: text("status").default("OPEN"), // OPEN | CLOSED
  notes: text("notes"),
  trade_date: text("trade_date").notNull(),
  close_date: text("close_date"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// family_members
// ---------------------------------------------------------------------------
export const familyMembers = pgTable("family_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  balance: numeric("balance").default("0").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// family_allowances
// ---------------------------------------------------------------------------
export const familyAllowances = pgTable("family_allowances", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  family_member_id: uuid("family_member_id").notNull(),
  amount: numeric("amount").notNull(),
  frequency: text("frequency").notNull(),
  last_paid_at: timestamp("last_paid_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// family_transfers
// ---------------------------------------------------------------------------
export const familyTransfers = pgTable("family_transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  family_member_id: uuid("family_member_id").notNull(),
  account_id: uuid("account_id").notNull(),
  amount: numeric("amount").notNull(),
  type: text("type").notNull(),
  transfer_date: timestamp("transfer_date").defaultNow().notNull(),
  note: text("note"),
});

// ---------------------------------------------------------------------------
// net_worth_snapshots
// ---------------------------------------------------------------------------
export const netWorthSnapshots = pgTable("net_worth_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  snapshot_date: text("snapshot_date").notNull(),
  net_worth: numeric("net_worth").default("0"),
  total_assets: numeric("total_assets").default("0"),
  total_liabilities: numeric("total_liabilities").default("0"),
  accounts_balance: numeric("accounts_balance").default("0"),
  investments_value: numeric("investments_value").default("0"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
