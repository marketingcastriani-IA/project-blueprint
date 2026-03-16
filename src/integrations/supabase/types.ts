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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          ai_suggestion: string | null
          cdi_rate: number | null
          closed_at: string | null
          created_at: string
          days_to_expiry: number | null
          expiry_date: string | null
          id: string
          name: string
          status: string
          underlying_asset: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_suggestion?: string | null
          cdi_rate?: number | null
          closed_at?: string | null
          created_at?: string
          days_to_expiry?: number | null
          expiry_date?: string | null
          id?: string
          name: string
          status?: string
          underlying_asset?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_suggestion?: string | null
          cdi_rate?: number | null
          closed_at?: string | null
          created_at?: string
          days_to_expiry?: number | null
          expiry_date?: string | null
          id?: string
          name?: string
          status?: string
          underlying_asset?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diversificacao_estrategias: {
        Row: {
          alavancagem: number
          ativo: boolean
          cor_texto: string | null
          created_at: string
          descricao: string | null
          diversificacao_id: string
          frequencia: string
          id: string
          min_acoes: number
          nome: string
          obs: string | null
          percentual: number
          risco: string
          vezes: number
        }
        Insert: {
          alavancagem?: number
          ativo?: boolean
          cor_texto?: string | null
          created_at?: string
          descricao?: string | null
          diversificacao_id: string
          frequencia?: string
          id?: string
          min_acoes?: number
          nome: string
          obs?: string | null
          percentual?: number
          risco?: string
          vezes?: number
        }
        Update: {
          alavancagem?: number
          ativo?: boolean
          cor_texto?: string | null
          created_at?: string
          descricao?: string | null
          diversificacao_id?: string
          frequencia?: string
          id?: string
          min_acoes?: number
          nome?: string
          obs?: string | null
          percentual?: number
          risco?: string
          vezes?: number
        }
        Relationships: [
          {
            foreignKeyName: "diversificacao_estrategias_diversificacao_id_fkey"
            columns: ["diversificacao_id"]
            isOneToOne: false
            referencedRelation: "diversificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      diversificacoes: {
        Row: {
          created_at: string
          id: string
          nome: string
          patrimonio: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          patrimonio?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          patrimonio?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      legs: {
        Row: {
          analysis_id: string
          asset: string
          created_at: string
          current_price: number | null
          expiry_date: string | null
          id: string
          option_type: string
          price: number
          quantity: number
          side: string
          strike: number
        }
        Insert: {
          analysis_id: string
          asset?: string
          created_at?: string
          current_price?: number | null
          expiry_date?: string | null
          id?: string
          option_type: string
          price?: number
          quantity?: number
          side: string
          strike?: number
        }
        Update: {
          analysis_id?: string
          asset?: string
          created_at?: string
          current_price?: number | null
          expiry_date?: string | null
          id?: string
          option_type?: string
          price?: number
          quantity?: number
          side?: string
          strike?: number
        }
        Relationships: [
          {
            foreignKeyName: "legs_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          id?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_access: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_type: string | null
          purchased_at: string | null
          simulations_count: number | null
          status: string
          trial_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_type?: string | null
          purchased_at?: string | null
          simulations_count?: number | null
          status?: string
          trial_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_type?: string | null
          purchased_at?: string | null
          simulations_count?: number | null
          status?: string
          trial_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
