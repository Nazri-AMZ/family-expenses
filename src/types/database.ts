export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type Database = {
  public: {
    Tables: {
      families: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          invite_code: string;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          invite_code?: string;
          currency?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["families"]["Insert"]>;
      };
      family_members: {
        Row: {
          id: string;
          family_id: string;
          user_id: string;
          role: "owner" | "member";
          display_name: string | null;
          avatar_color: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          user_id: string;
          role?: "owner" | "member";
          display_name?: string | null;
          avatar_color?: string | null;
          joined_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["family_members"]["Insert"]
        >;
      };
      categories: {
        Row: {
          id: string;
          family_id: string | null;
          name: string;
          icon: string;
          color: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id?: string | null;
          name: string;
          icon?: string;
          color?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      budgets: {
        Row: {
          id: string;
          family_id: string;
          category_id: string;
          amount: number;
          month: number;
          year: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          category_id: string;
          amount: number;
          month: number;
          year: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
      };
      expenses: {
        Row: {
          id: string;
          family_id: string;
          category_id: string | null;
          added_by: string;
          merchant: string;
          amount: number;
          currency: string;
          notes: string | null;
          expense_date: string;
          source: "manual" | "receipt_camera" | "receipt_upload";
          receipt_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          category_id?: string | null;
          added_by: string;
          merchant: string;
          amount: number;
          currency?: string;
          notes?: string | null;
          expense_date?: string;
          source?: "manual" | "receipt_camera" | "receipt_upload";
          receipt_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
      };
      receipts: {
        Row: {
          id: string;
          family_id: string;
          uploaded_by: string;
          storage_path: string;
          public_url: string | null;
          status: "pending" | "processing" | "done" | "failed";
          ai_raw_response: Json | null;
          ai_parsed: Json | null;
          merchant: string | null;
          total_amount: number | null;
          receipt_date: string | null;
          line_items: Json | null;
          expense_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          uploaded_by: string;
          storage_path: string;
          public_url?: string | null;
          status?: "pending" | "processing" | "done" | "failed";
          merchant?: string | null;
          total_amount?: number | null;
          receipt_date?: string | null;
          line_items?: Json | null;
          expense_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["receipts"]["Insert"]>;
      };
    };
    Views: {
      monthly_category_summary: {
        Row: {
          family_id: string;
          category_id: string;
          category_name: string;
          category_icon: string;
          category_color: string;
          month: number;
          year: number;
          total_spent: number;
          expense_count: number;
        };
      };
      monthly_member_summary: {
        Row: {
          family_id: string;
          user_id: string;
          display_name: string | null;
          avatar_color: string | null;
          month: number;
          year: number;
          total_spent: number;
          expense_count: number;
        };
      };
    };
  };
};

// Convenience type aliases
export type Family = Database["public"]["Tables"]["families"]["Row"];
export type FamilyMember =
  Database["public"]["Tables"]["family_members"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Budget = Database["public"]["Tables"]["budgets"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type MonthlyCategorySummary =
  Database["public"]["Views"]["monthly_category_summary"]["Row"];
export type MonthlyMemberSummary =
  Database["public"]["Views"]["monthly_member_summary"]["Row"];

export type ExpenseWithCategory = Expense & {
  categories: {
    name: string;
    icon: string;
    color: string;
  } | null;
};

export type GroupedExpenseRow = {
  id: string;
  family_id: string;
  added_by: string;
  merchant: string;
  amount: number;
  currency: string; // ← add
  category_id: string | null;
  notes: string | null;
  source: "manual" | "receipt_upload" | "receipt_camera";
  receipt_id: string | null;
  expense_date: string;
  created_at: string;
  updated_at: string; // ← add
  group_key: string;
  group_total: number;
  group_count: number;
};
