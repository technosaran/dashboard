export type Json =
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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string | null
          balance: number
          bank_logo: string | null
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
          bank_logo?: string | null
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
          bank_logo?: string | null
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
      deposits: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
      ledger_logs: {
        Row: {
          id: string
          user_id: string
          account_id: string | null
          account_name: string | null
          action_type: string
          amount: number | null
          previous_balance: number | null
          new_balance: number | null
          details: string | null
          source_id: string | null
          source_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id?: string | null
          account_name?: string | null
          action_type: string
          amount?: number | null
          previous_balance?: number | null
          new_balance?: number | null
          details?: string | null
          source_id?: string | null
          source_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string | null
          account_name?: string | null
          action_type?: string
          amount?: number | null
          previous_balance?: number | null
          new_balance?: number | null
          details?: string | null
          source_id?: string | null
          source_type?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      recipients: {
        Row: {
          id: string
          user_id: string
          name: string
          relationship: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          relationship?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          relationship?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          account_id: string | null
          description: string
          amount: number
          category: string
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id?: string | null
          description: string
          amount: number
          category: string
          date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string | null
          description?: string
          amount?: number
          category?: string
          date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      incomes: {
        Row: {
          id: string
          user_id: string
          account_id: string | null
          description: string
          amount: number
          category: string
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id?: string | null
          description: string
          amount: number
          category: string
          date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string | null
          description?: string
          amount?: number
          category?: string
          date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      investments: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          symbol: string | null
          quantity: number
          buy_price: number
          current_price: number
          currency: string
          notes: string | null
          bought_at: string | null
          realized_pnl: number
          previous_close: number | null
          day_change: number | null
          day_change_percent: number | null
          market_state: string | null
          last_fetch_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: string
          symbol?: string | null
          quantity?: number
          buy_price?: number
          current_price?: number
          currency?: string
          notes?: string | null
          bought_at?: string | null
          realized_pnl?: number
          previous_close?: number | null
          day_change?: number | null
          day_change_percent?: number | null
          market_state?: string | null
          last_fetch_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          symbol?: string | null
          quantity?: number
          buy_price?: number
          current_price?: number
          currency?: string
          notes?: string | null
          bought_at?: string | null
          realized_pnl?: number
          previous_close?: number | null
          day_change?: number | null
          day_change_percent?: number | null
          market_state?: string | null
          last_fetch_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_trades: {
        Row: {
          id: string
          user_id: string
          investment_id: string | null
          symbol: string
          trade_type: string
          quantity: number
          price: number
          charges: number
          total_amount: number
          trade_date: string
          exchange: string
          created_at: string
          ledger_log_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          investment_id?: string | null
          symbol: string
          trade_type: string
          quantity: number
          price: number
          charges?: number
          total_amount: number
          trade_date?: string
          exchange?: string
          created_at?: string
          ledger_log_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          investment_id?: string | null
          symbol?: string
          trade_type?: string
          quantity?: number
          price?: number
          charges?: number
          total_amount?: number
          trade_date?: string
          exchange?: string
          created_at?: string
          ledger_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_trades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_trades_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_expense: {
        Args: {
          p_user_id: string
          p_description: string
          p_amount: number
          p_category: string
          p_date: string
          p_account_id?: string | null
        }
        Returns: Json
      }
      revert_ledger_log: {
        Args: {
          p_log_id: string
          p_user_id: string
        }
        Returns: Json
      }
      process_transfer: {
        Args: {
          p_user_id: string
          p_from_account_id: string
          p_to_account_id: string
          p_amount: number
          p_note?: string | null
        }
        Returns: Json
      }
      process_family_transfer: {
        Args: {
          p_user_id: string
          p_account_id: string
          p_recipient_id: string
          p_amount: number
          p_note?: string | null
        }
        Returns: Json
      }
      record_income: {
        Args: {
          p_user_id: string
          p_description: string
          p_amount: number
          p_category: string
          p_date: string
          p_account_id?: string | null
        }
        Returns: Json
      }
      adjust_account_balance: {
        Args: {
          p_user_id: string
          p_account_id: string
          p_amount: number
          p_note: string
        }
        Returns: Json
      }
      create_account_atomic: {
        Args: {
          p_user_id: string
          p_name: string
          p_type: string
          p_balance: number
          p_color?: string | null
          p_institution?: string | null
          p_account_number?: string | null
        }
        Returns: Json
      }
      delete_account_atomic: {
        Args: {
          p_user_id: string
          p_account_id: string
        }
        Returns: Json
      }
      delete_account_atomic_v2: {
        Args: {
          p_user_id: string
          p_account_id: string
        }
        Returns: Json
      }
      record_investment: {
        Args: {
          p_user_id: string
          p_name: string
          p_type: string
          p_symbol: string | null
          p_quantity: number
          p_buy_price: number
          p_current_price: number
          p_currency: string
          p_notes: string | null
          p_date: string
          p_account_id: string | null
          p_total_cost: number
          p_trade_type: string
          p_charges: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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

export type TablesUpdate<
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

export type Enums<
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

export type CompositeTypes<
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

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
