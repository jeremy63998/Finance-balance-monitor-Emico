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
  public: {
    Tables: {
      app_access: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          note: string | null
          permissions: Json
          revoked_at: string | null
          revoked_by_email: string | null
          tenant_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          note?: string | null
          permissions?: Json
          revoked_at?: string | null
          revoked_by_email?: string | null
          tenant_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          note?: string | null
          permissions?: Json
          revoked_at?: string | null
          revoked_by_email?: string | null
          tenant_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          currency: string
          entered_by: string | null
          entered_by_email: string | null
          id: string
          is_active: boolean
          overdraft_limit: number
          remarks: string | null
          tenant_code: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          id?: string
          is_active?: boolean
          overdraft_limit?: number
          remarks?: string | null
          tenant_code: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          id?: string
          is_active?: boolean
          overdraft_limit?: number
          remarks?: string | null
          tenant_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_transactions: {
        Row: {
          amount: number
          bank_account_name: string
          bank_account_number: string | null
          created_at: string
          currency: string
          entered_by: string | null
          entered_by_email: string | null
          id: string
          is_superseded: boolean
          remarks: string | null
          supersedes_id: string | null
          tenant_code: string
          txn_date: string
          txn_type: string
        }
        Insert: {
          amount: number
          bank_account_name: string
          bank_account_number?: string | null
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          id?: string
          is_superseded?: boolean
          remarks?: string | null
          supersedes_id?: string | null
          tenant_code: string
          txn_date: string
          txn_type: string
        }
        Update: {
          amount?: number
          bank_account_name?: string
          bank_account_number?: string | null
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          id?: string
          is_superseded?: boolean
          remarks?: string | null
          supersedes_id?: string | null
          tenant_code?: string
          txn_date?: string
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "cash_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_snapshots: {
        Row: {
          created_at: string
          id: string
          net_liquidity: number
          snapshot_date: string
          tenant_code: string
          total_available: number
          total_cash: number
          total_drawn: number
          total_facility_limit: number
        }
        Insert: {
          created_at?: string
          id?: string
          net_liquidity?: number
          snapshot_date: string
          tenant_code: string
          total_available?: number
          total_cash?: number
          total_drawn?: number
          total_facility_limit?: number
        }
        Update: {
          created_at?: string
          id?: string
          net_liquidity?: number
          snapshot_date?: string
          tenant_code?: string
          total_available?: number
          total_cash?: number
          total_drawn?: number
          total_facility_limit?: number
        }
        Relationships: []
      }
      expected_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          cash_txn_id: string | null
          counterparty: string | null
          created_at: string
          currency: string
          direction: string
          due_date: string
          entered_by: string | null
          entered_by_email: string | null
          id: string
          remarks: string | null
          settled_at: string | null
          status: string
          tenant_code: string
          updated_at: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          cash_txn_id?: string | null
          counterparty?: string | null
          created_at?: string
          currency?: string
          direction?: string
          due_date: string
          entered_by?: string | null
          entered_by_email?: string | null
          id?: string
          remarks?: string | null
          settled_at?: string | null
          status?: string
          tenant_code: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          cash_txn_id?: string | null
          counterparty?: string | null
          created_at?: string
          currency?: string
          direction?: string
          due_date?: string
          entered_by?: string | null
          entered_by_email?: string | null
          id?: string
          remarks?: string | null
          settled_at?: string | null
          status?: string
          tenant_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      facilities: {
        Row: {
          amount_drawn: number
          amount_repaid: number
          created_at: string
          currency: string
          entered_by: string | null
          entered_by_email: string | null
          facility_type: string
          id: string
          interest_rate: number | null
          lending_bank: string
          maturity_date: string | null
          name: string
          remarks: string | null
          status: string
          tenant_code: string
          total_limit: number
          updated_at: string
        }
        Insert: {
          amount_drawn?: number
          amount_repaid?: number
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          facility_type: string
          id?: string
          interest_rate?: number | null
          lending_bank: string
          maturity_date?: string | null
          name: string
          remarks?: string | null
          status?: string
          tenant_code: string
          total_limit?: number
          updated_at?: string
        }
        Update: {
          amount_drawn?: number
          amount_repaid?: number
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          facility_type?: string
          id?: string
          interest_rate?: number | null
          lending_bank?: string
          maturity_date?: string | null
          name?: string
          remarks?: string | null
          status?: string
          tenant_code?: string
          total_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      facility_lc_amendments: {
        Row: {
          cash_txn_id: string | null
          charges_amount: number
          created_at: string
          currency: string
          entered_by: string | null
          entered_by_email: string | null
          id: string
          interest_amount: number
          lc_txn_id: string
          new_amount: number | null
          new_maturity_date: string | null
          postage_amount: number
          previous_amount: number | null
          previous_maturity_date: string | null
          remarks: string | null
          settled_at: string | null
          settlement_bank_account_id: string | null
          settlement_bank_account_name: string | null
          settlement_bank_account_number: string | null
          tenant_code: string
          txn_date: string
        }
        Insert: {
          cash_txn_id?: string | null
          charges_amount?: number
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          id?: string
          interest_amount?: number
          lc_txn_id: string
          new_amount?: number | null
          new_maturity_date?: string | null
          postage_amount?: number
          previous_amount?: number | null
          previous_maturity_date?: string | null
          remarks?: string | null
          settled_at?: string | null
          settlement_bank_account_id?: string | null
          settlement_bank_account_name?: string | null
          settlement_bank_account_number?: string | null
          tenant_code: string
          txn_date: string
        }
        Update: {
          cash_txn_id?: string | null
          charges_amount?: number
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          id?: string
          interest_amount?: number
          lc_txn_id?: string
          new_amount?: number | null
          new_maturity_date?: string | null
          postage_amount?: number
          previous_amount?: number | null
          previous_maturity_date?: string | null
          remarks?: string | null
          settled_at?: string | null
          settlement_bank_account_id?: string | null
          settlement_bank_account_name?: string | null
          settlement_bank_account_number?: string | null
          tenant_code?: string
          txn_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_lc_amendments_lc_txn_id_fkey"
            columns: ["lc_txn_id"]
            isOneToOne: false
            referencedRelation: "facility_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_transactions: {
        Row: {
          amount: number
          charges_amount: number
          charges_cash_txn_id: string | null
          charges_settled_at: string | null
          charges_timing: string | null
          created_at: string
          currency: string
          entered_by: string | null
          entered_by_email: string | null
          facility_id: string | null
          facility_name: string
          id: string
          interest_amount: number
          interest_cash_txn_id: string | null
          interest_settled_at: string | null
          interest_timing: string | null
          is_superseded: boolean
          lending_bank: string
          maturity_date: string | null
          postage_amount: number
          postage_cash_txn_id: string | null
          postage_settled_at: string | null
          postage_timing: string | null
          remarks: string | null
          settled_at: string | null
          settlement_bank_account_id: string | null
          settlement_bank_account_name: string | null
          settlement_bank_account_number: string | null
          settlement_cash_txn_id: string | null
          settlement_repayment_txn_id: string | null
          supersedes_id: string | null
          tenant_code: string
          txn_date: string
          txn_number: string | null
          txn_type: string
        }
        Insert: {
          amount: number
          charges_amount?: number
          charges_cash_txn_id?: string | null
          charges_settled_at?: string | null
          charges_timing?: string | null
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          facility_id?: string | null
          facility_name: string
          id?: string
          interest_amount?: number
          interest_cash_txn_id?: string | null
          interest_settled_at?: string | null
          interest_timing?: string | null
          is_superseded?: boolean
          lending_bank: string
          maturity_date?: string | null
          postage_amount?: number
          postage_cash_txn_id?: string | null
          postage_settled_at?: string | null
          postage_timing?: string | null
          remarks?: string | null
          settled_at?: string | null
          settlement_bank_account_id?: string | null
          settlement_bank_account_name?: string | null
          settlement_bank_account_number?: string | null
          settlement_cash_txn_id?: string | null
          settlement_repayment_txn_id?: string | null
          supersedes_id?: string | null
          tenant_code: string
          txn_date: string
          txn_number?: string | null
          txn_type: string
        }
        Update: {
          amount?: number
          charges_amount?: number
          charges_cash_txn_id?: string | null
          charges_settled_at?: string | null
          charges_timing?: string | null
          created_at?: string
          currency?: string
          entered_by?: string | null
          entered_by_email?: string | null
          facility_id?: string | null
          facility_name?: string
          id?: string
          interest_amount?: number
          interest_cash_txn_id?: string | null
          interest_settled_at?: string | null
          interest_timing?: string | null
          is_superseded?: boolean
          lending_bank?: string
          maturity_date?: string | null
          postage_amount?: number
          postage_cash_txn_id?: string | null
          postage_settled_at?: string | null
          postage_timing?: string | null
          remarks?: string | null
          settled_at?: string | null
          settlement_bank_account_id?: string | null
          settlement_bank_account_name?: string | null
          settlement_bank_account_number?: string | null
          settlement_cash_txn_id?: string | null
          settlement_repayment_txn_id?: string | null
          supersedes_id?: string | null
          tenant_code?: string
          txn_date?: string
          txn_number?: string | null
          txn_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
