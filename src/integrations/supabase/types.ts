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
          user_id: string | null
        }
        Insert: {
          contact_number: string
          created_at?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
          user_id?: string | null
        }
        Update: {
          contact_number?: string
          created_at?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      emergencies: {
        Row: {
          accepted_by_ambulance: string | null
          accepted_by_hospital: string | null
          created_at: string | null
          dispatched_to_ambulance: string | null
          guardian_notified: boolean | null
          id: string
          latitude: number | null
          longitude: number | null
          notified_at: string | null
          resolved_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          accepted_by_ambulance?: string | null
          accepted_by_hospital?: string | null
          created_at?: string | null
          dispatched_to_ambulance?: string | null
          guardian_notified?: boolean | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notified_at?: string | null
          resolved_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          accepted_by_ambulance?: string | null
          accepted_by_hospital?: string | null
          created_at?: string | null
          dispatched_to_ambulance?: string | null
          guardian_notified?: boolean | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notified_at?: string | null
          resolved_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergencies_dispatched_to_ambulance_fkey"
            columns: ["dispatched_to_ambulance"]
            isOneToOne: false
            referencedRelation: "ambulance_services"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_messages: {
        Row: {
          created_at: string
          emergency_id: string
          id: string
          message: string
          read: boolean
          sender_id: string
          sender_role: string
        }
        Insert: {
          created_at?: string
          emergency_id: string
          id?: string
          message: string
          read?: boolean
          sender_id: string
          sender_role: string
        }
        Update: {
          created_at?: string
          emergency_id?: string
          id?: string
          message?: string
          read?: boolean
          sender_id?: string
          sender_role?: string
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          created_at: string | null
          device_type: string
          id: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_type?: string
          id?: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_type?: string
          id?: string
          token?: string
          updated_at?: string | null
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
      hospital_ambulances: {
        Row: {
          ambulance_id: string
          created_at: string | null
          hospital_id: string
          id: string
        }
        Insert: {
          ambulance_id: string
          created_at?: string | null
          hospital_id: string
          id?: string
        }
        Update: {
          ambulance_id?: string
          created_at?: string | null
          hospital_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_ambulances_ambulance_id_fkey"
            columns: ["ambulance_id"]
            isOneToOne: false
            referencedRelation: "ambulance_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_ambulances_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_verifications: {
        Row: {
          certificate_url: string | null
          hospital_id: string | null
          id: string
          license_url: string
          status: string
          submitted_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          certificate_url?: string | null
          hospital_id?: string | null
          id?: string
          license_url: string
          status?: string
          submitted_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          certificate_url?: string | null
          hospital_id?: string | null
          id?: string
          license_url?: string
          status?: string
          submitted_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_verifications_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          contact_number: string | null
          created_at: string | null
          id: string
          latitude: number
          longitude: number
          name: string
          user_id: string | null
        }
        Insert: {
          contact_number?: string | null
          created_at?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
          user_id?: string | null
        }
        Update: {
          contact_number?: string | null
          created_at?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          user_id?: string | null
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
          profile_photo_url: string | null
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
          profile_photo_url?: string | null
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
          profile_photo_url?: string | null
          remarks?: string | null
          updated_at?: string | null
          user_id?: string
          vehicle_number?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      register_ambulance_for_hospital: {
        Args: {
          p_contact_number: string
          p_driver_name?: string
          p_hospital_id: string
          p_latitude: number
          p_longitude: number
          p_service_name: string
          p_vehicle_number?: string
        }
        Returns: string
      }
      register_hospital: {
        Args: {
          p_certificate_url?: string
          p_contact_number: string
          p_hospital_name: string
          p_latitude: number
          p_license_url: string
          p_longitude: number
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "hospital" | "ambulance" | "user"
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
      app_role: ["admin", "hospital", "ambulance", "user"],
    },
  },
} as const
