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
      carryovers: {
        Row: {
          deleted: boolean
          from_day: number
          id: string
          orig_key: string
          pts: number
          state: number
          text: string
          to_day: number
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          deleted?: boolean
          from_day: number
          id?: string
          orig_key: string
          pts?: number
          state?: number
          text: string
          to_day: number
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          deleted?: boolean
          from_day?: number
          id?: string
          orig_key?: string
          pts?: number
          state?: number
          text?: string
          to_day?: number
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      custom_sections: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string
          section_id: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          label: string
          section_id: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          section_id?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_tasks: {
        Row: {
          daily: boolean
          day_number: number
          deleted: boolean
          from_day: number | null
          id: string
          pts: number
          section_id: string
          state: number
          text: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          daily?: boolean
          day_number: number
          deleted?: boolean
          from_day?: number | null
          id?: string
          pts?: number
          section_id: string
          state?: number
          text: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          daily?: boolean
          day_number?: number
          deleted?: boolean
          from_day?: number | null
          id?: string
          pts?: number
          section_id?: string
          state?: number
          text?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      notepad_items: {
        Row: {
          day_number: number
          deleted: boolean
          from_day: number | null
          id: string
          pts: number
          state: number
          text: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          day_number: number
          deleted?: boolean
          from_day?: number | null
          id?: string
          pts?: number
          state?: number
          text: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          day_number?: number
          deleted?: boolean
          from_day?: number | null
          id?: string
          pts?: number
          state?: number
          text?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      task_states: {
        Row: {
          day_number: number
          deleted: boolean
          id: string
          state: number
          task_key: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          day_number: number
          deleted?: boolean
          id?: string
          state?: number
          task_key: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          day_number?: number
          deleted?: boolean
          id?: string
          state?: number
          task_key?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      week_history: {
        Row: {
          created_at: string
          date_range: string
          done: number
          id: string
          pts_done: number
          pts_pct: number
          pts_total: number
          task_pct: number
          total: number
          user_id: string
          week_number: number
          week_start: string
        }
        Insert: {
          created_at?: string
          date_range: string
          done?: number
          id?: string
          pts_done?: number
          pts_pct?: number
          pts_total?: number
          task_pct?: number
          total?: number
          user_id: string
          week_number: number
          week_start: string
        }
        Update: {
          created_at?: string
          date_range?: string
          done?: number
          id?: string
          pts_done?: number
          pts_pct?: number
          pts_total?: number
          task_pct?: number
          total?: number
          user_id?: string
          week_number?: number
          week_start?: string
        }
        Relationships: []
      }
      week_start_preference: {
        Row: {
          current_week_start: string
          id: string
          updated_at: string
          user_id: string
          week_number: number
        }
        Insert: {
          current_week_start: string
          id?: string
          updated_at?: string
          user_id: string
          week_number?: number
        }
        Update: {
          current_week_start?: string
          id?: string
          updated_at?: string
          user_id?: string
          week_number?: number
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
    Enums: {},
  },
} as const
