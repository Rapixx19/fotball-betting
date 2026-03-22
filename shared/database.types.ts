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
      chats: {
        Row: {
          created_at: string | null
          id: number
          title: string | null
          user_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          title?: string | null
          user_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          title?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      legs: {
        Row: {
          id: number
          match_id: number
          odds: number
          pick: string
          slip_id: number
          status: Database["public"]["Enums"]["leg_status"] | null
        }
        Insert: {
          id?: number
          match_id: number
          odds: number
          pick: string
          slip_id: number
          status?: Database["public"]["Enums"]["leg_status"] | null
        }
        Update: {
          id?: number
          match_id?: number
          odds?: number
          pick?: string
          slip_id?: number
          status?: Database["public"]["Enums"]["leg_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "legs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legs_slip_id_fkey"
            columns: ["slip_id"]
            isOneToOne: false
            referencedRelation: "slips"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_odds: number
          away_score: number | null
          away_team: string
          created_at: string | null
          draw_odds: number | null
          external_id: string | null
          home_odds: number
          home_score: number | null
          home_team: string
          id: number
          league: string
          sport: string
          starts_at: string
          status: Database["public"]["Enums"]["match_status"] | null
        }
        Insert: {
          away_odds: number
          away_score?: number | null
          away_team: string
          created_at?: string | null
          draw_odds?: number | null
          external_id?: string | null
          home_odds: number
          home_score?: number | null
          home_team: string
          id?: number
          league: string
          sport: string
          starts_at: string
          status?: Database["public"]["Enums"]["match_status"] | null
        }
        Update: {
          away_odds?: number
          away_score?: number | null
          away_team?: string
          created_at?: string | null
          draw_odds?: number | null
          external_id?: string | null
          home_odds?: number
          home_score?: number | null
          home_team?: string
          id?: number
          league?: string
          sport?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["match_status"] | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: number
          content: string
          created_at: string | null
          id: number
          role: string
        }
        Insert: {
          chat_id: number
          content: string
          created_at?: string | null
          id?: number
          role: string
        }
        Update: {
          chat_id?: number
          content?: string
          created_at?: string | null
          id?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      slips: {
        Row: {
          created_at: string | null
          id: number
          potential_payout: number | null
          stake: number | null
          status: Database["public"]["Enums"]["slip_status"] | null
          user_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          potential_payout?: number | null
          stake?: number | null
          status?: Database["public"]["Enums"]["slip_status"] | null
          user_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          potential_payout?: number | null
          stake?: number | null
          status?: Database["public"]["Enums"]["slip_status"] | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "slips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: number
          password: string
          password_reset_expires: string | null
          password_reset_token: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: number
          password: string
          password_reset_expires?: string | null
          password_reset_token?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: number
          password?: string
          password_reset_expires?: string | null
          password_reset_token?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_id: { Args: never; Returns: number }
    }
    Enums: {
      leg_status: "pending" | "won" | "lost" | "push"
      match_status: "upcoming" | "live" | "final"
      slip_status: "pending" | "won" | "lost" | "push"
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
      leg_status: ["pending", "won", "lost", "push"],
      match_status: ["upcoming", "live", "final"],
      slip_status: ["pending", "won", "lost", "push"],
    },
  },
} as const
