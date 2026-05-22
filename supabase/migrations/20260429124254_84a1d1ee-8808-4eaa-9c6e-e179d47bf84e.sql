ALTER TABLE public.cancelamentos
  ADD COLUMN IF NOT EXISTS sheet_synced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sheet_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sheet_error text;

-- Permitir UPDATE (necessário para marcar registros como sincronizados)
DROP POLICY IF EXISTS "Anyone can update cancelamentos" ON public.cancelamentos;
CREATE POLICY "Anyone can update cancelamentos"
  ON public.cancelamentos
  FOR UPDATE
  USING (true)
  WITH CHECK (true);