export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      cancelamento_status_history: {
        Row: {
          cancelamento_id: string;
          changed_by: string | null;
          changed_by_name: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["cancelamento_status"] | null;
          id: string;
          note: string | null;
          to_status: Database["public"]["Enums"]["cancelamento_status"];
        };
        Insert: {
          cancelamento_id: string;
          changed_by?: string | null;
          changed_by_name?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["cancelamento_status"] | null;
          id?: string;
          note?: string | null;
          to_status: Database["public"]["Enums"]["cancelamento_status"];
        };
        Update: {
          cancelamento_id?: string;
          changed_by?: string | null;
          changed_by_name?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["cancelamento_status"] | null;
          id?: string;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["cancelamento_status"];
        };
        Relationships: [
          {
            foreignKeyName: "cancelamento_status_history_cancelamento_id_fkey";
            columns: ["cancelamento_id"];
            isOneToOne: false;
            referencedRelation: "cancelamentos";
            referencedColumns: ["id"];
          },
        ];
      };
      cancelamentos: {
        Row: {
          agencia: string | null;
          banco: string | null;
          cancelar_com_multa: boolean | null;
          cnpj: string | null;
          conta: string | null;
          contato_1: string | null;
          contato_2: string | null;
          cpf: string | null;
          created_at: string;
          data_nascimento: string | null;
          email: string | null;
          endereco_completo: string | null;
          fatura_url: string | null;
          fixo: string | null;
          forma_pagamento: string | null;
          id: string;
          nome_cliente: string;
          nome_mae: string | null;
          numero_contrato: string | null;
          operadora: string | null;
          ponto_referencia: string | null;
          queima: string | null;
          sheet_error: string | null;
          sheet_synced: boolean;
          sheet_synced_at: string | null;
          status: Database["public"]["Enums"]["cancelamento_status"];
          status_updated_at: string;
          status_updated_by: string | null;
          supervisor: string | null;
          valor_maximo_multa: number | null;
        };
        Insert: {
          agencia?: string | null;
          banco?: string | null;
          cancelar_com_multa?: boolean | null;
          cnpj?: string | null;
          conta?: string | null;
          contato_1?: string | null;
          contato_2?: string | null;
          cpf?: string | null;
          created_at?: string;
          data_nascimento?: string | null;
          email?: string | null;
          endereco_completo?: string | null;
          fatura_url?: string | null;
          fixo?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          nome_cliente: string;
          nome_mae?: string | null;
          numero_contrato?: string | null;
          operadora?: string | null;
          ponto_referencia?: string | null;
          queima?: string | null;
          sheet_error?: string | null;
          sheet_synced?: boolean;
          sheet_synced_at?: string | null;
          status?: Database["public"]["Enums"]["cancelamento_status"];
          status_updated_at?: string;
          status_updated_by?: string | null;
          supervisor?: string | null;
          valor_maximo_multa?: number | null;
        };
        Update: {
          agencia?: string | null;
          banco?: string | null;
          cancelar_com_multa?: boolean | null;
          cnpj?: string | null;
          conta?: string | null;
          contato_1?: string | null;
          contato_2?: string | null;
          cpf?: string | null;
          created_at?: string;
          data_nascimento?: string | null;
          email?: string | null;
          endereco_completo?: string | null;
          fatura_url?: string | null;
          fixo?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          nome_cliente?: string;
          nome_mae?: string | null;
          numero_contrato?: string | null;
          operadora?: string | null;
          ponto_referencia?: string | null;
          queima?: string | null;
          sheet_error?: string | null;
          sheet_synced?: boolean;
          sheet_synced_at?: string | null;
          status?: Database["public"]["Enums"]["cancelamento_status"];
          status_updated_at?: string;
          status_updated_by?: string | null;
          supervisor?: string | null;
          valor_maximo_multa?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          email: string;
          id: string;
          is_active: boolean;
          must_change_credentials: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          email: string;
          id: string;
          is_active?: boolean;
          must_change_credentials?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          email?: string;
          id?: string;
          is_active?: boolean;
          must_change_credentials?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "total" | "supervisor" | "consultor";
      cancelamento_status:
        | "pendente"
        | "em_andamento"
        | "aguardando_cliente"
        | "concluido"
        | "cancelado"
        | "falhou";
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "total", "supervisor", "consultor"],
      cancelamento_status: [
        "pendente",
        "em_andamento",
        "aguardando_cliente",
        "concluido",
        "cancelado",
        "falhou",
      ],
    },
  },
} as const;
