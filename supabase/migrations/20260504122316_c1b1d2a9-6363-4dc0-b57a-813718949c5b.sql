-- Enum de status
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

-- Colunas em cancelamentos
ALTER TABLE public.cancelamentos
  ADD COLUMN IF NOT EXISTS status public.cancelamento_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status_updated_by UUID;

CREATE INDEX IF NOT EXISTS idx_cancelamentos_status ON public.cancelamentos(status);

-- Tabela de histórico
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

CREATE INDEX IF NOT EXISTS idx_csh_cancelamento ON public.cancelamento_status_history(cancelamento_id, created_at DESC);

ALTER TABLE public.cancelamento_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view history" ON public.cancelamento_status_history;
CREATE POLICY "Authenticated can view history"
  ON public.cancelamento_status_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert history" ON public.cancelamento_status_history;
CREATE POLICY "Authenticated can insert history"
  ON public.cancelamento_status_history FOR INSERT TO authenticated WITH CHECK (true);
