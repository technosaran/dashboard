/* eslint-disable */
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alternative_assets: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string
          purchase_price: number
          current_value: number
          purchase_date: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category: string
          purchase_price?: number
          current_value?: number
          purchase_date?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          category?: string
          purchase_price?: number
          current_value?: number
          purchase_date?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category: string
          amount: number
          period_month: number
          period_year: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          category: string
          amount?: number
          period_month: number
          period_year: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          amount?: number
          period_month?: number
          period_year?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      liabilities: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string
          total_amount: number
          remaining_amount: number
          interest_rate: number | null
          monthly_payment: number | null
          due_date: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category: string
          total_amount?: number
          remaining_amount?: number
          interest_rate?: number | null
          monthly_payment?: number | null
          due_date?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          category?: string
          total_amount?: number
          remaining_amount?: number
          interest_rate?: number | null
          monthly_payment?: number | null
          due_date?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_number: string | null
          balance: number
          bank_name: string | null
          color: string | null
          created_at: string
          currency: string
          id: string
          institution: string | null
          name: string
          type: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          balance?: number
          bank_name?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          name: string
          type: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          balance?: number
          bank_name?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      bond_transactions: {
        Row: {
          account_id: string | null
          amount: number
          bond_id: string | null
          created_at: string | null
          id: string
          interest_amount: number | null
          interest_period_end: string | null
          interest_period_start: string | null
          notes: string | null
          price_per_bond: number | null
          quantity: number | null
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          bond_id?: string | null
          created_at?: string | null
          id?: string
          interest_amount?: number | null
          interest_period_end?: string | null
          interest_period_start?: string | null
          notes?: string | null
          price_per_bond?: number | null
          quantity?: number | null
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          bond_id?: string | null
          created_at?: string | null
          id?: string
          interest_amount?: number | null
          interest_period_end?: string | null
          interest_period_start?: string | null
          notes?: string | null
          price_per_bond?: number | null
          quantity?: number | null
          transaction_date?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bond_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bond_transactions_bond_id_fkey"
            columns: ["bond_id"]
            isOneToOne: false
            referencedRelation: "bonds"
            referencedColumns: ["id"]
          },
        ]
      }
      bonds: {
        Row: {
          accrued_interest: number | null
          bond_name: string
          bond_type: string
          coupon_rate: number
          created_at: string | null
          credit_rating: string | null
          current_price: number
          current_value: number
          demat_account: string | null
          face_value: number
          id: string
          interest_frequency: string | null
          isin: string
          issuer: string
          maturity_date: string
          next_interest_date: string | null
          notes: string | null
          platform: string | null
          purchase_date: string
          purchase_price: number
          quantity: number
          status: string | null
          total_interest_earned: number | null
          total_invested: number
          updated_at: string | null
          user_id: string
          ytm: number | null
        }
        Insert: {
          accrued_interest?: number | null
          bond_name: string
          bond_type: string
          coupon_rate: number
          created_at?: string | null
          credit_rating?: string | null
          current_price: number
          current_value: number
          demat_account?: string | null
          face_value?: number
          id?: string
          interest_frequency?: string | null
          isin: string
          issuer: string
          maturity_date: string
          next_interest_date?: string | null
          notes?: string | null
          platform?: string | null
          purchase_date: string
          purchase_price: number
          quantity?: number
          status?: string | null
          total_interest_earned?: number | null
          total_invested: number
          updated_at?: string | null
          user_id: string
          ytm?: number | null
        }
        Update: {
          accrued_interest?: number | null
          bond_name?: string
          bond_type?: string
          coupon_rate?: number
          created_at?: string | null
          credit_rating?: string | null
          current_price?: number
          current_value?: number
          demat_account?: string | null
          face_value?: number
          id?: string
          interest_frequency?: string | null
          isin?: string
          issuer?: string
          maturity_date?: string
          next_interest_date?: string | null
          notes?: string | null
          platform?: string | null
          purchase_date?: string
          purchase_price?: number
          quantity?: number
          status?: string | null
          total_interest_earned?: number | null
          total_invested?: number
          updated_at?: string | null
          user_id?: string
          ytm?: number | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string | null
          date: string | null
          description: string
          id: string
          is_recurring: boolean | null
          last_generated_date: string | null
          recurrence_day: number | null
          recurrence_end_date: string | null
          recurrence_frequency: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: string
          created_at?: string | null
          date?: string | null
          description: string
          id?: string
          is_recurring?: boolean | null
          last_generated_date?: string | null
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          recurrence_frequency?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string | null
          date?: string | null
          description?: string
          id?: string
          is_recurring?: boolean | null
          last_generated_date?: string | null
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          recurrence_frequency?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category: string | null
          created_at: string | null
          current_amount: number
          deadline: string | null
          id: string
          name: string
          target_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          current_amount?: number
          deadline?: string | null
          id?: string
          name: string
          target_amount?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          current_amount?: number
          deadline?: string | null
          id?: string
          name?: string
          target_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string | null
          date: string | null
          description: string
          id: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: string
          created_at?: string | null
          date?: string | null
          description: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string | null
          date?: string | null
          description?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          bought_at: string | null
          buy_price: number
          created_at: string
          currency: string
          current_price: number
          day_change: number | null
          day_change_percent: number | null
          id: string
          last_fetch_at: string | null
          market_state: string | null
          name: string
          notes: string | null
          previous_close: number | null
          quantity: number
          realized_pnl: number | null
          symbol: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bought_at?: string | null
          buy_price?: number
          created_at?: string
          currency?: string
          current_price?: number
          day_change?: number | null
          day_change_percent?: number | null
          id?: string
          last_fetch_at?: string | null
          market_state?: string | null
          name: string
          notes?: string | null
          previous_close?: number | null
          quantity?: number
          realized_pnl?: number | null
          symbol?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bought_at?: string | null
          buy_price?: number
          created_at?: string
          currency?: string
          current_price?: number
          day_change?: number | null
          day_change_percent?: number | null
          id?: string
          last_fetch_at?: string | null
          market_state?: string | null
          name?: string
          notes?: string | null
          previous_close?: number | null
          quantity?: number
          realized_pnl?: number | null
          symbol?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_logs: {
        Row: {
          account_id: string | null
          account_name: string | null
          action_type: string
          amount: number | null
          created_at: string | null
          details: string | null
          id: string
          metadata: Json | null
          new_balance: number | null
          previous_balance: number | null
          source_id: string | null
          source_type: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          action_type: string
          amount?: number | null
          created_at?: string | null
          details?: string | null
          id?: string
          metadata?: Json | null
          new_balance?: number | null
          previous_balance?: number | null
          source_id?: string | null
          source_type?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          action_type?: string
          amount?: number | null
          created_at?: string | null
          details?: string | null
          id?: string
          metadata?: Json | null
          new_balance?: number | null
          previous_balance?: number | null
          source_id?: string | null
          source_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mutual_fund_trades: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string | null
          date: string | null
          exit_load_details: string | null
          fund_name: string
          id: string
          ledger_log_id: string | null
          mf_id: string | null
          nav: number
          realized_pnl: number | null
          stamp_duty: number | null
          trade_type: string
          units: number
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string | null
          date?: string | null
          exit_load_details?: string | null
          fund_name: string
          id?: string
          ledger_log_id?: string | null
          mf_id?: string | null
          nav: number
          realized_pnl?: number | null
          stamp_duty?: number | null
          trade_type: string
          units: number
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string | null
          date?: string | null
          exit_load_details?: string | null
          fund_name?: string
          id?: string
          ledger_log_id?: string | null
          mf_id?: string | null
          nav?: number
          realized_pnl?: number | null
          stamp_duty?: number | null
          trade_type?: string
          units?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mutual_fund_trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutual_fund_trades_ledger_log_id_fkey"
            columns: ["ledger_log_id"]
            isOneToOne: false
            referencedRelation: "ledger_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutual_fund_trades_mf_id_fkey"
            columns: ["mf_id"]
            isOneToOne: false
            referencedRelation: "mutual_funds"
            referencedColumns: ["id"]
          },
        ]
      }
      mutual_funds: {
        Row: {
          amc_name: string | null
          avg_nav: number
          category: string | null
          created_at: string | null
          current_nav: number
          expense_ratio: number | null
          fund_name: string
          fund_symbol: string | null
          id: string
          investment_type: string | null
          last_nav_updated_at: string | null
          realized_pnl: number | null
          scheme_code: string | null
          units: number
          updated_at: string | null
          user_id: string
          previous_nav: number | null
          day_change: number | null
          day_change_percent: number | null
        }
        Insert: {
          amc_name?: string | null
          avg_nav?: number
          category?: string | null
          created_at?: string | null
          current_nav?: number
          expense_ratio?: number | null
          fund_name: string
          fund_symbol?: string | null
          id?: string
          investment_type?: string | null
          last_nav_updated_at?: string | null
          realized_pnl?: number | null
          scheme_code?: string | null
          units?: number
          updated_at?: string | null
          user_id: string
          previous_nav?: number | null
          day_change?: number | null
          day_change_percent?: number | null
        }
        Update: {
          amc_name?: string | null
          avg_nav?: number
          category?: string | null
          created_at?: string | null
          current_nav?: number
          expense_ratio?: number | null
          fund_name?: string
          fund_symbol?: string | null
          id?: string
          investment_type?: string | null
          last_nav_updated_at?: string | null
          realized_pnl?: number | null
          scheme_code?: string | null
          units?: number
          updated_at?: string | null
          user_id?: string
          previous_nav?: number | null
          day_change?: number | null
          day_change_percent?: number | null
        }
        Relationships: []
      }
      net_worth_snapshots: {
        Row: {
          accounts_balance: number
          created_at: string
          id: string
          investments_value: number
          net_worth: number
          snapshot_date: string
          total_assets: number
          total_liabilities: number
          user_id: string
        }
        Insert: {
          accounts_balance?: number
          created_at?: string
          id?: string
          investments_value?: number
          net_worth?: number
          snapshot_date: string
          total_assets?: number
          total_liabilities?: number
          user_id: string
        }
        Update: {
          accounts_balance?: number
          created_at?: string
          id?: string
          investments_value?: number
          net_worth?: number
          snapshot_date?: string
          total_assets?: number
          total_liabilities?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          username: string | null
          base_currency: string
          theme: string
          timezone: string
          enabled_modules: Json
          default_accounts: Json
        }
        Insert: {
          created_at?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
          base_currency?: string
          theme?: string
          timezone?: string
          enabled_modules?: Json
          default_accounts?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
          base_currency?: string
          theme?: string
          timezone?: string
          enabled_modules?: Json
          default_accounts?: Json
        }
        Relationships: []
      }
      recipients: {
        Row: {
          created_at: string | null
          id: string
          name: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stock_trades: {
        Row: {
          charges: number | null
          created_at: string | null
          exchange: string | null
          id: string
          investment_id: string | null
          ledger_log_id: string | null
          price: number
          quantity: number
          realized_pnl: number | null
          symbol: string
          total_amount: number
          trade_date: string | null
          trade_type: string
          user_id: string
        }
        Insert: {
          charges?: number | null
          created_at?: string | null
          exchange?: string | null
          id?: string
          investment_id?: string | null
          ledger_log_id?: string | null
          price: number
          quantity: number
          realized_pnl?: number | null
          symbol: string
          total_amount: number
          trade_date?: string | null
          trade_type: string
          user_id: string
        }
        Update: {
          charges?: number | null
          created_at?: string | null
          exchange?: string | null
          id?: string
          investment_id?: string | null
          ledger_log_id?: string | null
          price?: number
          quantity?: number
          realized_pnl?: number | null
          symbol?: string
          total_amount?: number
          trade_date?: string | null
          trade_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_trades_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_trades_ledger_log_id_fkey"
            columns: ["ledger_log_id"]
            isOneToOne: false
            referencedRelation: "ledger_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          created_at: string
          date: string
          description: string
          id: string
          ledger_log_id: string | null
          source_id: string | null
          source_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category?: string | null
          created_at?: string
          date?: string
          description: string
          id?: string
          ledger_log_id?: string | null
          source_id?: string | null
          source_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          ledger_log_id?: string | null
          source_id?: string | null
          source_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          from_account_id: string
          id: string
          note: string | null
          to_account_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_account_id: string
          id?: string
          note?: string | null
          to_account_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_account_id?: string
          id?: string
          note?: string | null
          to_account_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      forex_accounts: {
        Row: {
          id: string
          user_id: string
          broker_name: string
          account_label: string
          account_number: string | null
          balance: number
          total_deposited: number
          total_withdrawn: number
          total_pnl: number
          currency: string
          status: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          broker_name: string
          account_label: string
          account_number?: string | null
          balance?: number
          total_deposited?: number
          total_withdrawn?: number
          total_pnl?: number
          currency?: string
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          broker_name?: string
          account_label?: string
          account_number?: string | null
          balance?: number
          total_deposited?: number
          total_withdrawn?: number
          total_pnl?: number
          currency?: string
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      forex_trades: {
        Row: {
          id: string
          user_id: string
          forex_account_id: string
          pair: string
          trade_type: string
          lot_size: number
          entry_price: number | null
          exit_price: number | null
          pnl: number
          trade_date: string
          close_date: string | null
          status: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          forex_account_id: string
          pair: string
          trade_type: string
          lot_size: number
          entry_price?: number | null
          exit_price?: number | null
          pnl?: number
          trade_date?: string
          close_date?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          forex_account_id?: string
          pair?: string
          trade_type?: string
          lot_size?: number
          entry_price?: number | null
          exit_price?: number | null
          pnl?: number
          trade_date?: string
          close_date?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [{
          foreignKeyName: "forex_trades_forex_account_id_fkey"
          columns: ["forex_account_id"]
          isOneToOne: false
          referencedRelation: "forex_accounts"
          referencedColumns: ["id"]
        }]
      }
      forex_transactions: {
        Row: {
          id: string
          user_id: string
          forex_account_id: string
          bank_account_id: string | null
          transaction_type: string
          amount: number
          notes: string | null
          transaction_date: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          forex_account_id: string
          bank_account_id?: string | null
          transaction_type: string
          amount: number
          notes?: string | null
          transaction_date?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          forex_account_id?: string
          bank_account_id?: string | null
          transaction_type?: string
          amount?: number
          notes?: string | null
          transaction_date?: string
          created_at?: string | null
        }
        Relationships: [{
          foreignKeyName: "forex_transactions_forex_account_id_fkey"
          columns: ["forex_account_id"]
          isOneToOne: false
          referencedRelation: "forex_accounts"
          referencedColumns: ["id"]
        }, {
          foreignKeyName: "forex_transactions_bank_account_id_fkey"
          columns: ["bank_account_id"]
          isOneToOne: false
          referencedRelation: "accounts"
          referencedColumns: ["id"]
        }]
      }
      fno_trades: {
        Row: {
          id: string
          user_id: string
          symbol: string
          instrument_type: "FUT" | "CE" | "PE"
          strike_price: number | null
          expiry_date: string
          trade_type: "BUY" | "SELL"
          quantity: number
          entry_price: number
          exit_price: number | null
          pnl: number | null
          status: "OPEN" | "CLOSED"
          account_id: string | null
          ledger_log_id: string | null
          close_ledger_log_id: string | null
          notes: string | null
          trade_date: string
          close_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          symbol: string
          instrument_type: "FUT" | "CE" | "PE"
          strike_price?: number | null
          expiry_date: string
          trade_type: "BUY" | "SELL"
          quantity: number
          entry_price: number
          exit_price?: number | null
          pnl?: number | null
          status?: "OPEN" | "CLOSED"
          account_id?: string | null
          ledger_log_id?: string | null
          close_ledger_log_id?: string | null
          notes?: string | null
          trade_date?: string
          close_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          symbol?: string
          instrument_type?: "FUT" | "CE" | "PE"
          strike_price?: number | null
          expiry_date?: string
          trade_type?: "BUY" | "SELL"
          quantity?: number
          entry_price?: number
          exit_price?: number | null
          pnl?: number | null
          status?: "OPEN" | "CLOSED"
          account_id?: string | null
          ledger_log_id?: string | null
          close_ledger_log_id?: string | null
          notes?: string | null
          trade_date?: string
          close_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          account_count: number | null
          currency: string | null
          total_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      monthly_spending: {
        Row: {
          month: string | null
          total_monthly_amount: number | null
          transaction_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      atomic_delete_entity: {
        Args: {
          p_user_id: string
          p_entity_type: string
          p_entity_id: string
        }
        Returns: Json
      }
      adjust_account_balance: {
        Args: {
          p_account_id: string
          p_amount: number
          p_note?: string
          p_user_id: string
        }
        Returns: Json
      }
      calculate_accrued_interest: {
        Args: { p_bond_id: string }
        Returns: number
      }
      contribute_to_goal: {
        Args: {
          p_account_id: string
          p_amount: number
          p_goal_id: string
          p_user_id: string
        }
        Returns: Json
      }
      create_account_atomic:
        | {
            Args: {
              p_account_number?: string
              p_balance: number
              p_color?: string
              p_institution?: string
              p_name: string
              p_type: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_account_number?: string
              p_balance: number
              p_bank_name?: string
              p_color?: string
              p_currency?: string
              p_institution?: string
              p_name: string
              p_type: string
              p_user_id: string
            }
            Returns: Json
          }
      delete_account_atomic_v2: {
        Args: { p_account_id: string; p_user_id: string }
        Returns: Json
      }
      delete_account_v2: {
        Args: { p_account_id: string; p_user_id: string }
        Returns: Json
      }
      get_finance_overview: { Args: never; Returns: Json }
      initialize_goal: {
        Args: {
          p_account_id?: string
          p_category: string
          p_deadline: string
          p_initial_amount: number
          p_name: string
          p_target_amount: number
          p_user_id: string
        }
        Returns: Json
      }
      process_family_transfer: {
        Args: {
          p_account_id: string
          p_amount: number
          p_note?: string
          p_recipient_id: string
          p_user_id: string
        }
        Returns: Json
      }
      process_transfer: {
        Args: {
          p_amount: number
          p_from_account_id: string
          p_note?: string
          p_to_account_id: string
          p_user_id: string
        }
        Returns: Json
      }
      record_bond_interest: {
        Args: {
          p_account_id?: string
          p_amount: number
          p_bond_id: string
          p_payment_date: string
          p_period_end: string
          p_period_start: string
          p_user_id: string
        }
        Returns: Json
      }
      record_bond_purchase: {
        Args: {
          p_account_id?: string
          p_bond_name: string
          p_bond_type: string
          p_coupon_rate: number
          p_credit_rating?: string
          p_current_price: number
          p_demat_account?: string
          p_face_value: number
          p_interest_frequency?: string
          p_isin: string
          p_issuer: string
          p_maturity_date?: string
          p_next_interest_date?: string
          p_notes?: string
          p_platform?: string
          p_purchase_date?: string
          p_purchase_price: number
          p_quantity: number
          p_user_id: string
          p_ytm?: number
        }
        Returns: Json
      }
      record_expense: {
        Args: {
          p_account_id?: string
          p_amount: number
          p_category: string
          p_date: string
          p_description: string
          p_user_id: string
        }
        Returns: Json
      }
      record_income: {
        Args: {
          p_account_id?: string
          p_amount: number
          p_category: string
          p_date: string
          p_description: string
          p_user_id: string
        }
        Returns: Json
      }
      record_investment: {
        Args: {
          p_account_id: string
          p_buy_price: number
          p_charges: number
          p_currency: string
          p_current_price: number
          p_date: string
          p_name: string
          p_notes: string
          p_quantity: number
          p_symbol: string
          p_total_cost: number
          p_trade_type: string
          p_type: string
          p_user_id: string
        }
        Returns: Json
      }
      record_mf_investment: {
        Args: {
          p_account_id: string
          p_amc_name: string
          p_category: string
          p_date: string
          p_fund_name: string
          p_fund_symbol: string
          p_investment_type: string
          p_nav: number
          p_units: number
          p_user_id: string
        }
        Returns: Json
      }
      record_mf_investment_v2: {
        Args: {
          p_account_id: string
          p_amc_name: string
          p_category: string
          p_date: string
          p_fund_name: string
          p_investment_type: string
          p_nav: number
          p_scheme_code: string
          p_stamp_duty: number
          p_units: number
          p_user_id: string
        }
        Returns: Json
      }
      record_mf_investment_v3: {
        Args: {
          p_account_id: string
          p_amc_name: string
          p_category: string
          p_date: string
          p_fund_name: string
          p_investment_type: string
          p_nav: number
          p_scheme_code: string
          p_stamp_duty: number
          p_trade_type?: string
          p_units: number
          p_user_id: string
        }
        Returns: Json
      }
      record_mf_investment_v4: {
        Args: {
          p_account_id: string
          p_amc_name: string
          p_category: string
          p_date: string
          p_fund_name: string
          p_investment_type: string
          p_nav: number
          p_scheme_code: string
          p_stamp_duty?: number
          p_trade_type?: string
          p_units: number
          p_user_id: string
        }
        Returns: Json
      }
      get_summary_v1: {
        Args: Record<PropertyKey, never>
        Returns: {
          profile: { username: string; base_currency: string; theme: string; timezone: string; enabled_modules: string[]; default_accounts?: Record<string, string | null>; } | null
          accounts: Database["public"]["Tables"]["accounts"]["Row"][]
          transactions: Database["public"]["Tables"]["transactions"]["Row"][]
          ledgerLogs: Database["public"]["Tables"]["ledger_logs"]["Row"][]
        }
      }
      get_investments_v1: {
        Args: Record<PropertyKey, never>
        Returns: {
          investments: Database["public"]["Tables"]["investments"]["Row"][]
          mutualFunds: Database["public"]["Tables"]["mutual_funds"]["Row"][]
          bonds: Database["public"]["Tables"]["bonds"]["Row"][]
          alternativeAssets: Database["public"]["Tables"]["alternative_assets"]["Row"][]
          stockTrades: Database["public"]["Tables"]["stock_trades"]["Row"][]
          mutualFundTrades: Database["public"]["Tables"]["mutual_fund_trades"]["Row"][]
          bondTransactions: Database["public"]["Tables"]["bond_transactions"]["Row"][]
          fnoTrades: Database["public"]["Tables"]["fno_trades"]["Row"][]
        }
      }
      get_cashflow_v1: {
        Args: Record<PropertyKey, never>
        Returns: {
          incomes: Database["public"]["Tables"]["incomes"]["Row"][]
          expenses: Database["public"]["Tables"]["expenses"]["Row"][]
          budgets: Database["public"]["Tables"]["budgets"]["Row"][]
          goals: Database["public"]["Tables"]["goals"]["Row"][]
          liabilities: Database["public"]["Tables"]["liabilities"]["Row"][]
        }
      }
      get_forex_v1: {
        Args: Record<PropertyKey, never>
        Returns: {
          forexAccounts: Database["public"]["Tables"]["forex_accounts"]["Row"][]
          forexTrades: Database["public"]["Tables"]["forex_trades"]["Row"][]
          forexTransactions: Database["public"]["Tables"]["forex_transactions"]["Row"][]
        }
      }
      get_family_v1: {
        Args: Record<PropertyKey, never>
        Returns: {
          recipients: Database["public"]["Tables"]["recipients"]["Row"][]
        }
      }
      get_finance_overview_v2: {
        Args: Record<PropertyKey, never>
        Returns: {
          profile: { username: string; base_currency: string; theme: string; timezone: string; enabled_modules: string[]; default_accounts?: Record<string, string | null>; } | null
          accounts: Database["public"]["Tables"]["accounts"]["Row"][]
          transactions: Database["public"]["Tables"]["transactions"]["Row"][]
          ledgerLogs: Database["public"]["Tables"]["ledger_logs"]["Row"][]
          investments: Database["public"]["Tables"]["investments"]["Row"][]
          mutualFunds: Database["public"]["Tables"]["mutual_funds"]["Row"][]
          bonds: Database["public"]["Tables"]["bonds"]["Row"][]
          alternativeAssets: Database["public"]["Tables"]["alternative_assets"]["Row"][]
          stockTrades: Database["public"]["Tables"]["stock_trades"]["Row"][]
          mutualFundTrades: Database["public"]["Tables"]["mutual_fund_trades"]["Row"][]
          bondTransactions: Database["public"]["Tables"]["bond_transactions"]["Row"][]
          fnoTrades: Database["public"]["Tables"]["fno_trades"]["Row"][]
          incomes: Database["public"]["Tables"]["incomes"]["Row"][]
          expenses: Database["public"]["Tables"]["expenses"]["Row"][]
          budgets: Database["public"]["Tables"]["budgets"]["Row"][]
          goals: Database["public"]["Tables"]["goals"]["Row"][]
          liabilities: Database["public"]["Tables"]["liabilities"]["Row"][]
          forexAccounts: Database["public"]["Tables"]["forex_accounts"]["Row"][]
          forexTrades: Database["public"]["Tables"]["forex_trades"]["Row"][]
          forexTransactions: Database["public"]["Tables"]["forex_transactions"]["Row"][]
          recipients: Database["public"]["Tables"]["recipients"]["Row"][]
        }
      }
      reset_user_data: { Args: { p_user_id: string }; Returns: Json }
      revert_ledger_log: {
        Args: { p_log_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      account_category:
        | "checking"
        | "savings"
        | "credit"
        | "investment"
        | "cash"
      ledger_action:
        | "CREATE"
        | "UPDATE"
        | "DELETE"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "ADJUST_UP"
        | "ADJUST_DOWN"
        | "LOG_ONLY"
        | "SEND_MONEY"
        | "SEND_MONEY_IN"
        | "INVESTMENT_MF"
        | "INVESTMENT_STOCK"
        | "INVESTMENT_GOLD"
        | "GOAL_INIT"
        | "GOAL_CONTRIBUTION"
        | "GOAL_WITHDRAWAL"
        | "REVERSAL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

const Constants = {
  public: {
    Enums: {
      account_category: ["checking", "savings", "credit", "investment", "cash"],
      ledger_action: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "ADJUST_UP",
        "ADJUST_DOWN",
        "LOG_ONLY",
        "SEND_MONEY",
      ],
    },
  },
} as const
