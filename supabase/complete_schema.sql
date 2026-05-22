-- ============================================================================
-- AGS Telecom - Cancelamento Express
-- FULL DATABASE SCHEMA & SECURITY DESIGN (Production Ready)
-- Author: Senior DBA / Fullstack Developer
-- Target Platform: Supabase (PostgreSQL)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCHEMAS & CUSTOM TYPES / ENUMS
-- ----------------------------------------------------------------------------

-- Private schema to isolate security functions and prevent PostgREST RPC access
CREATE SCHEMA IF NOT EXISTS private;

-- App role enum representing user access tiers
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'total', 'supervisor', 'consultor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cancelamento progress status enum
DO $$ BEGIN
  CREATE TYPE public.cancelamento_status AS ENUM (
    'pendente',
    'em_andamento',
    'aguardando_cliente',
    'concluido',
    'cancelado',
    'falhou'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. APPLICATION TABLES
-- ----------------------------------------------------------------------------

-- Profiles Table (Linked 1:1 to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  must_change_credentials BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles Table (Associates roles to users)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Cancelamentos Table (Main operational records)
CREATE TABLE IF NOT EXISTS public.cancelamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operadora TEXT,
  supervisor TEXT,
  nome_cliente TEXT NOT NULL,
  cpf TEXT,
  cnpj TEXT,
  email TEXT,
  nome_mae TEXT,
  data_nascimento DATE,
  endereco_completo TEXT,
  ponto_referencia TEXT,
  contato_1 TEXT,
  contato_2 TEXT,
  fixo TEXT,
  forma_pagamento TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  queima TEXT,
  numero_contrato TEXT,
  cancelar_com_multa BOOLEAN DEFAULT false,
  valor_maximo_multa NUMERIC,
  fatura_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Sheets sync tracking columns
  sheet_synced BOOLEAN NOT NULL DEFAULT false,
  sheet_synced_at TIMESTAMPTZ,
  sheet_error TEXT,
  
  -- Status tracking columns
  status public.cancelamento_status NOT NULL DEFAULT 'pendente',
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_updated_by UUID
);

-- Cancelamento Status History Table (Audit logging for status transitions)
CREATE TABLE IF NOT EXISTS public.cancelamento_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancelamento_id UUID NOT NULL REFERENCES public.cancelamentos(id) ON DELETE CASCADE,
  from_status public.cancelamento_status,
  to_status public.cancelamento_status NOT NULL,
  changed_by UUID,
  changed_by_name TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. INDEXES (Performance Optimizations)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cancelamentos_status ON public.cancelamentos(status);
CREATE INDEX IF NOT EXISTS idx_csh_cancelamento ON public.cancelamento_status_history(cancelamento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- ----------------------------------------------------------------------------
-- 4. DATABASE PROCEDURES & FUNCTIONS
-- ----------------------------------------------------------------------------

-- SECURITY DEFINER function to check user roles without causing RLS recursion
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Trigger function to automatically update `updated_at` timestamps on row modification
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger function to automatically create a user profile on auth registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, must_change_credentials)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'must_change_credentials')::boolean, true)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. TRIGGERS SETUP
-- ----------------------------------------------------------------------------

-- Bind update timestamp trigger to profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Bind profile generation trigger to auth.users inserts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. SECURITY GRANTS & FUNCTION RESTRICTIONS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) & POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancelamento_status_history ENABLE ROW LEVEL SECURITY;

-- == RLS POLICIES FOR: profiles ==
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- == RLS POLICIES FOR: user_roles ==
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- == RLS POLICIES FOR: cancelamentos ==
DROP POLICY IF EXISTS "Authenticated can view cancelamentos" ON public.cancelamentos;
CREATE POLICY "Authenticated can view cancelamentos" ON public.cancelamentos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Active users can insert cancelamentos" ON public.cancelamentos;
CREATE POLICY "Active users can insert cancelamentos" ON public.cancelamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "Active users can update cancelamentos" ON public.cancelamentos;
CREATE POLICY "Active users can update cancelamentos" ON public.cancelamentos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

-- == RLS POLICIES FOR: cancelamento_status_history ==
DROP POLICY IF EXISTS "Authenticated can view history" ON public.cancelamento_status_history;
CREATE POLICY "Authenticated can view history" ON public.cancelamento_status_history
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Active users can insert history" ON public.cancelamento_status_history;
CREATE POLICY "Active users can insert history" ON public.cancelamento_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKETS & OBJECT POLICIES (Private Files Storage)
-- ----------------------------------------------------------------------------

-- Create bucket 'faturas' under private storage if not already existing
INSERT INTO storage.buckets (id, name, public)
VALUES ('faturas', 'faturas', false)
ON CONFLICT (id) DO NOTHING;

-- Revoke all public read/write configurations on objects and enable selective RLS

-- == STORAGE OBJECTS POLICIES ==
DROP POLICY IF EXISTS "Authenticated can read faturas" ON storage.objects;
CREATE POLICY "Authenticated can read faturas" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'faturas');

DROP POLICY IF EXISTS "Authenticated can upload faturas" ON storage.objects;
CREATE POLICY "Authenticated can upload faturas" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'faturas');

DROP POLICY IF EXISTS "Authenticated can update faturas" ON storage.objects;
CREATE POLICY "Authenticated can update faturas" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'faturas')
  WITH CHECK (bucket_id = 'faturas');

DROP POLICY IF EXISTS "Authenticated can delete faturas" ON storage.objects;
CREATE POLICY "Authenticated can delete faturas" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'faturas');
