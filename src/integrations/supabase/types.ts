export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      carryovers: {
        Row: {
          deleted: boolean;
          from_day: number;
          id: string;
          orig_key: string;
          pts: number;
          state: number;
          text: string;
          to_day: number;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          deleted?: boolean;
          from_day: number;
          id?: string;
          orig_key: string;
          pts?: number;
          state?: number;
          text: string;
          to_day: number;
          updated_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          deleted?: boolean;
          from_day?: number;
          id?: string;
          orig_key?: string;
          pts?: number;
          state?: number;
          text?: string;
          to_day?: number;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      custom_sections: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          label: string;
          section_id: string;
          user_id: string;
        };
        Insert: {
          color: string;
          created_at?: string;
          id?: string;
          label: string;
          section_id: string;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          label?: string;
          section_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      custom_tasks: {
        Row: {
          daily: boolean;
          day_number: number;
          deleted: boolean;
          from_day: number | null;
          id: string;
          pts: number;
          section_id: string;
          state: number;
          text: string;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          daily?: boolean;
          day_number: number;
          deleted?: boolean;
          from_day?: number | null;
          id?: string;
          pts?: number;
          section_id: string;
          state?: number;
          text: string;
          updated_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          daily?: boolean;
          day_number?: number;
          deleted?: boolean;
          from_day?: number | null;
          id?: string;
          pts?: number;
          section_id?: string;
          state?: number;
          text?: string;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          user_id_a: string;
          user_id_b: string;
          status: string;
          requested_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id_a: string;
          user_id_b: string;
          status?: string;
          requested_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id_a?: string;
          user_id_b?: string;
          status?: string;
          requested_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      group_invitations: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          invited_by: string;
          invited_email: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          invited_by: string;
          invited_email: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          invited_by?: string;
          invited_email?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          email: string | null;
          group_id: string;
          id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          display_name?: string | null;
          email?: string | null;
          group_id: string;
          id?: string;
          joined_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          display_name?: string | null;
          email?: string | null;
          group_id?: string;
          id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_sections: {
        Row: {
          color: string;
          created_at: string;
          group_id: string;
          id: string;
          label: string;
        };
        Insert: {
          color: string;
          created_at?: string;
          group_id: string;
          id?: string;
          label: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          group_id?: string;
          id?: string;
          label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_sections_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_tasks: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          created_by: string;
          deleted: boolean;
          description: string | null;
          due_date: string | null;
          group_id: string;
          id: string;
          position: number;
          priority: string;
          pts: number;
          section_id: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          created_by: string;
          deleted?: boolean;
          description?: string | null;
          due_date?: string | null;
          group_id: string;
          id?: string;
          position?: number;
          priority?: string;
          pts?: number;
          section_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          created_by?: string;
          deleted?: boolean;
          description?: string | null;
          due_date?: string | null;
          group_id?: string;
          id?: string;
          position?: number;
          priority?: string;
          pts?: number;
          section_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_tasks_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_weekly_points: {
        Row: {
          group_id: string;
          id: string;
          points: number;
          tasks_done: number;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          group_id: string;
          id?: string;
          points?: number;
          tasks_done?: number;
          updated_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          group_id?: string;
          id?: string;
          points?: number;
          tasks_done?: number;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_weekly_points_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mentorships: {
        Row: {
          created_at: string;
          id: string;
          mentee_avatar: string | null;
          mentee_email: string;
          mentee_id: string | null;
          mentee_name: string | null;
          mentor_avatar: string | null;
          mentor_id: string;
          mentor_name: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mentee_avatar?: string | null;
          mentee_email: string;
          mentee_id?: string | null;
          mentee_name?: string | null;
          mentor_avatar?: string | null;
          mentor_id: string;
          mentor_name?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mentee_avatar?: string | null;
          mentee_email?: string;
          mentee_id?: string | null;
          mentee_name?: string | null;
          mentor_avatar?: string | null;
          mentor_id?: string;
          mentor_name?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notepad_items: {
        Row: {
          day_number: number;
          deleted: boolean;
          from_day: number | null;
          id: string;
          pts: number;
          state: number;
          text: string;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          day_number: number;
          deleted?: boolean;
          from_day?: number | null;
          id?: string;
          pts?: number;
          state?: number;
          text: string;
          updated_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          day_number?: number;
          deleted?: boolean;
          from_day?: number | null;
          id?: string;
          pts?: number;
          state?: number;
          text?: string;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          actor_name: string | null;
          body: string | null;
          created_at: string;
          handled: boolean;
          id: string;
          kind: string;
          read: boolean;
          ref_group_id: string | null;
          ref_invitation_id: string | null;
          ref_mentorship_id: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_name?: string | null;
          body?: string | null;
          created_at?: string;
          handled?: boolean;
          id?: string;
          kind: string;
          read?: boolean;
          ref_group_id?: string | null;
          ref_invitation_id?: string | null;
          ref_mentorship_id?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_name?: string | null;
          body?: string | null;
          created_at?: string;
          handled?: boolean;
          id?: string;
          kind?: string;
          read?: boolean;
          ref_group_id?: string | null;
          ref_invitation_id?: string | null;
          ref_mentorship_id?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      task_states: {
        Row: {
          day_number: number;
          deleted: boolean;
          id: string;
          state: number;
          task_key: string;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          day_number: number;
          deleted?: boolean;
          id?: string;
          state?: number;
          task_key: string;
          updated_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          day_number?: number;
          deleted?: boolean;
          id?: string;
          state?: number;
          task_key?: string;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      user_app_state: {
        Row: {
          data: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          data: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          data?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      week_history: {
        Row: {
          created_at: string;
          date_range: string;
          done: number;
          id: string;
          pts_done: number;
          pts_pct: number;
          pts_total: number;
          task_pct: number;
          total: number;
          user_id: string;
          week_number: number;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          date_range: string;
          done?: number;
          id?: string;
          pts_done?: number;
          pts_pct?: number;
          pts_total?: number;
          task_pct?: number;
          total?: number;
          user_id: string;
          week_number: number;
          week_start: string;
        };
        Update: {
          created_at?: string;
          date_range?: string;
          done?: number;
          id?: string;
          pts_done?: number;
          pts_pct?: number;
          pts_total?: number;
          task_pct?: number;
          total?: number;
          user_id?: string;
          week_number?: number;
          week_start?: string;
        };
        Relationships: [];
      };
      week_start_preference: {
        Row: {
          current_week_start: string;
          id: string;
          updated_at: string;
          user_id: string;
          week_number: number;
        };
        Insert: {
          current_week_start: string;
          id?: string;
          updated_at?: string;
          user_id: string;
          week_number?: number;
        };
        Update: {
          current_week_start?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
          week_number?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_read_user_state: {
        Args: { _target: string };
        Returns: Json;
      };
      is_group_member: {
        Args: { _group: string; _user: string };
        Returns: boolean;
      };
      is_mentor_of: {
        Args: { _mentee: string; _mentor: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
