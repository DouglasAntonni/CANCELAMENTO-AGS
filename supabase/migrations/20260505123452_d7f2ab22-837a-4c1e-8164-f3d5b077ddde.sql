-- 1) Endurecer RLS de cancelamentos: exigir usuário autenticado ativo
DROP POLICY IF EXISTS "Authenticated can update cancelamentos" ON public.cancelamentos;
DROP POLICY IF EXISTS "Authenticated can insert cancelamentos" ON public.cancelamentos;

CREATE POLICY "Active users can insert cancelamentos"
ON public.cancelamentos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active = true
  )
);

CREATE POLICY "Active users can update cancelamentos"
ON public.cancelamentos
FOR UPDATE
TO authenticated
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

-- 2) Endurecer RLS do histórico de status
DROP POLICY IF EXISTS "Authenticated can insert history" ON public.cancelamento_status_history;

CREATE POLICY "Active users can insert history"
ON public.cancelamento_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active = true
  )
);

-- 3) Travar execução das funções SECURITY DEFINER
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 4) Bucket "faturas" privado + políticas de acesso restritas
UPDATE storage.buckets SET public = false WHERE id = 'faturas';

DROP POLICY IF EXISTS "faturas_public_read" ON storage.objects;
DROP POLICY IF EXISTS "Public read faturas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read faturas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload faturas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update faturas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete faturas" ON storage.objects;

CREATE POLICY "Authenticated can read faturas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'faturas');

CREATE POLICY "Authenticated can upload faturas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'faturas');

CREATE POLICY "Authenticated can update faturas"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'faturas')
WITH CHECK (bucket_id = 'faturas');

CREATE POLICY "Authenticated can delete faturas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'faturas');