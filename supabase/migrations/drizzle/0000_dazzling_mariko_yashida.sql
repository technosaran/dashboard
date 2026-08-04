CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"balance" numeric DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"bank_name" text,
	"institution" text,
	"account_number" text,
	"color" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alternative_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"purchase_price" numeric DEFAULT '0',
	"current_value" numeric DEFAULT '0',
	"purchase_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bond_id" uuid,
	"account_id" uuid,
	"transaction_type" text NOT NULL,
	"amount" numeric NOT NULL,
	"quantity" numeric,
	"price_per_bond" numeric,
	"interest_amount" numeric,
	"interest_period_start" date,
	"interest_period_end" date,
	"notes" text,
	"transaction_date" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bonds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"isin" text NOT NULL,
	"bond_name" text NOT NULL,
	"issuer" text NOT NULL,
	"bond_type" text NOT NULL,
	"face_value" numeric DEFAULT '1000',
	"coupon_rate" numeric NOT NULL,
	"purchase_price" numeric NOT NULL,
	"current_price" numeric NOT NULL,
	"quantity" numeric DEFAULT '1',
	"total_invested" numeric NOT NULL,
	"current_value" numeric NOT NULL,
	"purchase_date" date NOT NULL,
	"maturity_date" date NOT NULL,
	"next_interest_date" date,
	"interest_frequency" text,
	"credit_rating" text,
	"platform" text,
	"demat_account" text,
	"ytm" numeric,
	"accrued_interest" numeric,
	"total_interest_earned" numeric,
	"status" text DEFAULT 'Active',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"description" text NOT NULL,
	"amount" numeric NOT NULL,
	"category" text NOT NULL,
	"date" timestamp DEFAULT now(),
	"is_recurring" boolean DEFAULT false,
	"recurrence_frequency" text,
	"recurrence_day" integer,
	"recurrence_end_date" timestamp,
	"last_generated_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_allowances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_member_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"frequency" text NOT NULL,
	"last_paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text NOT NULL,
	"avatar_url" text,
	"balance" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_member_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"type" text NOT NULL,
	"transfer_date" timestamp DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "fno_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"ledger_log_id" uuid,
	"close_ledger_log_id" uuid,
	"symbol" text NOT NULL,
	"instrument_type" text NOT NULL,
	"strike_price" numeric,
	"expiry_date" date NOT NULL,
	"trade_type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"entry_price" numeric NOT NULL,
	"exit_price" numeric,
	"pnl" numeric,
	"status" text DEFAULT 'OPEN',
	"notes" text,
	"trade_date" date NOT NULL,
	"close_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forex_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"broker_name" text NOT NULL,
	"account_label" text NOT NULL,
	"account_number" text,
	"balance" numeric DEFAULT '0',
	"total_deposited" numeric DEFAULT '0',
	"total_withdrawn" numeric DEFAULT '0',
	"total_pnl" numeric DEFAULT '0',
	"currency" text DEFAULT 'USD',
	"status" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forex_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"forex_account_id" uuid NOT NULL,
	"pair" text NOT NULL,
	"trade_type" text NOT NULL,
	"lot_size" real NOT NULL,
	"entry_price" numeric,
	"exit_price" numeric,
	"pnl" numeric DEFAULT '0',
	"status" text,
	"notes" text,
	"trade_date" timestamp DEFAULT now() NOT NULL,
	"close_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forex_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"forex_account_id" uuid NOT NULL,
	"bank_account_id" uuid,
	"transaction_type" text NOT NULL,
	"amount" numeric NOT NULL,
	"notes" text,
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount" numeric DEFAULT '0',
	"current_amount" numeric DEFAULT '0',
	"deadline" timestamp,
	"category" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"description" text NOT NULL,
	"amount" numeric NOT NULL,
	"category" text NOT NULL,
	"date" timestamp DEFAULT now(),
	"is_recurring" boolean DEFAULT false,
	"recurrence_frequency" text,
	"recurrence_day" integer,
	"recurrence_end_date" timestamp,
	"last_generated_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"symbol" text,
	"quantity" numeric DEFAULT '0',
	"buy_price" numeric DEFAULT '0',
	"current_price" numeric DEFAULT '0',
	"previous_close" numeric,
	"day_change" numeric,
	"day_change_percent" numeric,
	"currency" text DEFAULT 'INR' NOT NULL,
	"notes" text,
	"bought_at" timestamp,
	"realized_pnl" numeric,
	"market_state" text,
	"last_fetch_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"account_name" text,
	"action_type" text NOT NULL,
	"amount" numeric,
	"previous_balance" numeric,
	"new_balance" numeric,
	"details" text,
	"source_type" text,
	"source_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "liabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"total_amount" numeric DEFAULT '0',
	"remaining_amount" numeric DEFAULT '0',
	"interest_rate" numeric,
	"monthly_payment" numeric,
	"due_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mutual_fund_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mf_id" uuid,
	"account_id" uuid,
	"ledger_log_id" uuid,
	"fund_name" text NOT NULL,
	"trade_type" text NOT NULL,
	"units" numeric NOT NULL,
	"nav" numeric NOT NULL,
	"amount" numeric NOT NULL,
	"stamp_duty" numeric,
	"exit_load_details" text,
	"realized_pnl" numeric,
	"date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mutual_funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fund_name" text NOT NULL,
	"fund_symbol" text,
	"scheme_code" text,
	"amc_name" text,
	"category" text,
	"investment_type" text,
	"units" numeric DEFAULT '0',
	"avg_nav" numeric DEFAULT '0',
	"current_nav" numeric DEFAULT '0',
	"previous_nav" numeric,
	"day_change" numeric,
	"day_change_percent" numeric,
	"expense_ratio" numeric,
	"realized_pnl" numeric,
	"last_nav_updated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text,
	"base_currency" text DEFAULT 'INR' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"enabled_modules" jsonb DEFAULT '[]'::jsonb,
	"default_accounts" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"investment_id" uuid,
	"ledger_log_id" uuid,
	"symbol" text NOT NULL,
	"trade_type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"price" numeric NOT NULL,
	"total_amount" numeric NOT NULL,
	"charges" numeric,
	"realized_pnl" numeric,
	"exchange" text,
	"trade_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" numeric NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"date" timestamp DEFAULT now() NOT NULL,
	"source_type" text,
	"source_id" uuid,
	"ledger_log_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_account_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alternative_assets_user_id_idx" ON "alternative_assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bond_transactions_user_id_idx" ON "bond_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bond_transactions_account_id_idx" ON "bond_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "bonds_user_id_idx" ON "bonds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budgets_user_id_idx" ON "budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expenses_user_id_idx" ON "expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expenses_account_id_idx" ON "expenses" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "family_allowances_user_id_idx" ON "family_allowances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "family_members_user_id_idx" ON "family_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "family_transfers_user_id_idx" ON "family_transfers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "family_transfers_account_id_idx" ON "family_transfers" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "fno_trades_user_id_idx" ON "fno_trades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fno_trades_account_id_idx" ON "fno_trades" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "forex_accounts_user_id_idx" ON "forex_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "forex_trades_user_id_idx" ON "forex_trades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "forex_trades_forex_account_id_idx" ON "forex_trades" USING btree ("forex_account_id");--> statement-breakpoint
CREATE INDEX "forex_transactions_user_id_idx" ON "forex_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "forex_transactions_forex_account_id_idx" ON "forex_transactions" USING btree ("forex_account_id");--> statement-breakpoint
CREATE INDEX "forex_transactions_bank_account_id_idx" ON "forex_transactions" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "goals_user_id_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "incomes_user_id_idx" ON "incomes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "incomes_account_id_idx" ON "incomes" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "investments_user_id_idx" ON "investments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ledger_logs_user_id_idx" ON "ledger_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ledger_logs_account_id_idx" ON "ledger_logs" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "liabilities_user_id_idx" ON "liabilities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mutual_fund_trades_user_id_idx" ON "mutual_fund_trades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mutual_fund_trades_account_id_idx" ON "mutual_fund_trades" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "mutual_funds_user_id_idx" ON "mutual_funds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipients_user_id_idx" ON "recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_trades_user_id_idx" ON "stock_trades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transfers_user_id_idx" ON "transfers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transfers_from_account_id_idx" ON "transfers" USING btree ("from_account_id");--> statement-breakpoint
CREATE INDEX "transfers_to_account_id_idx" ON "transfers" USING btree ("to_account_id");