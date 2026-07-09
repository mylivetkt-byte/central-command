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
      alerts: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          message: string
          resolved: boolean
          severity: string
          type: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          severity?: string
          type: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          severity?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          company_id: string | null
          created_at: string
          delivery_id: string
          id: string
          message: string
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          delivery_id: string
          id?: string
          message: string
          read_at?: string | null
          sender_id: string
          sender_role: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          delivery_id?: string
          id?: string
          message?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "pending_delivery_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          amount: number
          cancelled_at: string | null
          commission: number
          company_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          delivery_address: string
          delivery_lat: number | null
          delivery_lng: number | null
          driver_id: string | null
          estimated_time: number | null
          id: string
          is_delayed: boolean
          notes: string | null
          order_id: string
          picked_up_at: string | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
          zone: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount?: number
          cancelled_at?: string | null
          commission?: number
          company_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          driver_id?: string | null
          estimated_time?: number | null
          id?: string
          is_delayed?: boolean
          notes?: string | null
          order_id: string
          picked_up_at?: string | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          zone?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          cancelled_at?: string | null
          commission?: number
          company_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          driver_id?: string | null
          estimated_time?: number | null
          id?: string
          is_delayed?: boolean
          notes?: string | null
          order_id?: string
          picked_up_at?: string | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_audit_log: {
        Row: {
          company_id: string | null
          created_at: string
          delivery_id: string
          details: string | null
          event: string
          id: string
          performed_by: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          delivery_id: string
          details?: string | null
          event: string
          id?: string
          performed_by?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          delivery_id?: string
          details?: string | null
          event?: string
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_audit_log_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_audit_log_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "pending_delivery_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          company_id: string | null
          driver_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          speed: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          driver_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          speed?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          driver_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          acceptance_rate: number | null
          avg_delivery_time: number | null
          cancellation_rate: number | null
          company_id: string | null
          created_at: string
          current_load: number
          id: string
          rating: number | null
          status: string
          total_deliveries: number
          updated_at: string
          vehicle_type: string | null
          zone: string | null
        }
        Insert: {
          acceptance_rate?: number | null
          avg_delivery_time?: number | null
          cancellation_rate?: number | null
          company_id?: string | null
          created_at?: string
          current_load?: number
          id: string
          rating?: number | null
          status?: string
          total_deliveries?: number
          updated_at?: string
          vehicle_type?: string | null
          zone?: string | null
        }
        Update: {
          acceptance_rate?: number | null
          avg_delivery_time?: number | null
          cancellation_rate?: number | null
          company_id?: string | null
          created_at?: string
          current_load?: number
          id?: string
          rating?: number | null
          status?: string
          total_deliveries?: number
          updated_at?: string
          vehicle_type?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_push_subscriptions: {
        Row: {
          auth_key: string
          company_id: string | null
          created_at: string
          driver_id: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth_key: string
          company_id?: string | null
          created_at?: string
          driver_id: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth_key?: string
          company_id?: string | null
          created_at?: string
          driver_id?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_push_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saas_companies: {
        Row: {
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          max_drivers: number
          name: string
          nit: string | null
          phone: string | null
          plan: string
          plan_value: number
          primary_color: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          max_drivers?: number
          name: string
          nit?: string | null
          phone?: string | null
          plan?: string
          plan_value?: number
          primary_color?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          max_drivers?: number
          name?: string
          nit?: string | null
          phone?: string | null
          plan?: string
          plan_value?: number
          primary_color?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      saas_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          period_end: string
          period_start: string
          status: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_end: string
          period_start: string
          status: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_end?: string
          period_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
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
      pending_delivery_offers: {
        Row: {
          amount: number | null
          commission: number | null
          company_id: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          estimated_time: number | null
          id: string | null
          order_id: string | null
          pickup_address: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          status: Database["public"]["Enums"]["delivery_status"] | null
          zone: string | null
        }
        Insert: {
          amount?: number | null
          commission?: number | null
          company_id?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          estimated_time?: number | null
          id?: string | null
          order_id?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          zone?: string | null
        }
        Update: {
          amount?: number | null
          commission?: number | null
          company_id?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          estimated_time?: number | null
          id?: string | null
          order_id?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saas_companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_delivery: { Args: { p_delivery_id: string }; Returns: Json }
      delete_company_completely: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      get_company_users_list: {
        Args: { p_company_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          role: string
          status: string
          user_id: string
        }[]
      }
      get_driver_stats: { Args: { p_driver_id?: string }; Returns: Json }
      get_my_role: { Args: never; Returns: string }
      get_user_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_driver_audit_entry: {
        Args: { p_delivery_id: string; p_details?: string; p_event: string }
        Returns: undefined
      }
      is_super_admin: { Args: { uid: string }; Returns: boolean }
      reset_company_data: { Args: { p_company_id: string }; Returns: string }
      set_user_password: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: boolean
      }
      user_can_access_company: {
        Args: { record_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "driver" | "super_admin"
      delivery_status:
        | "pendiente"
        | "aceptado"
        | "en_camino"
        | "entregado"
        | "cancelado"
      driver_status: "activo" | "inactivo" | "suspendido" | "en_ruta"
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
      app_role: ["admin", "driver", "super_admin"],
      delivery_status: [
        "pendiente",
        "aceptado",
        "en_camino",
        "entregado",
        "cancelado",
      ],
      driver_status: ["activo", "inactivo", "suspendido", "en_ruta"],
    },
  },
} as const
