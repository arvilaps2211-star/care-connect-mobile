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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ambulance_services: {
        Row: {
          contact_number: string
          created_at: string | null
          id: string
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          contact_number: string
          created_at?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          contact_number?: string
          created_at?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      emergencies: {
        Row: {
          accepted_by_ambulance: string | null
          accepted_by_hospital: string | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          resolved_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          accepted_by_ambulance?: string | null
          accepted_by_hospital?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          resolved_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          accepted_by_ambulance?: string | null
          accepted_by_hospital?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          resolved_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      guardians: {
        Row: {
          contact_number: string
          created_at: string | null
          id: string
          name: string
          relationship: string
          user_id: string
        }
        Insert: {
          contact_number: string
          created_at?: string | null
          id?: string
          name: string
          relationship: string
          user_id: string
        }
        Update: {
          contact_number?: string
          created_at?: string | null
          id?: string
          name?: string
          relationship?: string
          user_id?: string
        }
        Relationships: []
      }
      hospitals: {
        Row: {
          contact_number: string | null
          created_at: string | null
          email: string
          id: string
          latitude: number
          longitude: number
          name: string
          password_hash: string
        }
        Insert: {
          contact_number?: string | null
          created_at?: string | null
          email: string
          id?: string
          latitude: number
          longitude: number
          name: string
          password_hash: string
        }
        Update: {
          contact_number?: string | null
          created_at?: string | null
          email?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          password_hash?: string
        }
        Relationships: []
      }
      medical_info: {
        Row: {
          additional_notes: string | null
          blood_group: string | null
          created_at: string | null
          id: string
          medical_history: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          blood_group?: string | null
          created_at?: string | null
          id?: string
          medical_history?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          blood_group?: string | null
          created_at?: string | null
          id?: string
          medical_history?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          age: number | null
          created_at: string | null
          gender: string | null
          id: string
          name: string
          onboarding_completed: boolean | null
          phone: string
          remarks: string | null
          updated_at: string | null
          user_id: string
          vehicle_number: string | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          created_at?: string | null
          gender?: string | null
          id?: string
          name: string
          onboarding_completed?: boolean | null
          phone: string
          remarks?: string | null
          updated_at?: string | null
          user_id: string
          vehicle_number?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          created_at?: string | null
          gender?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean | null
          phone?: string
          remarks?: string | null
          updated_at?: string | null
          user_id?: string
          vehicle_number?: string | null
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
