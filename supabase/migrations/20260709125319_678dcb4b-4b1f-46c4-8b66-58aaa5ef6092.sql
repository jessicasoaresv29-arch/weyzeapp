
-- 1. profiles: restrict to authenticated
DROP POLICY IF EXISTS "Perfis são públicos" ON public.profiles;
CREATE POLICY "Perfis visíveis a autenticados"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- 2. avaliacoes: public view without comentario; restrict full row to authenticated
DROP POLICY IF EXISTS "Avaliações públicas" ON public.avaliacoes;
CREATE POLICY "Avaliações visíveis a autenticados"
  ON public.avaliacoes FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE VIEW public.avaliacoes_publicas
  WITH (security_invoker = true) AS
  SELECT id, prestador_id, cliente_id, contrato_id, nota, created_at
    FROM public.avaliacoes;
GRANT SELECT ON public.avaliacoes_publicas TO anon, authenticated;
REVOKE SELECT ON public.avaliacoes FROM anon;

-- 3. chat storage: restrict to conversation participants (folder = conversa_id)
DROP POLICY IF EXISTS "Chat: autenticado lê" ON storage.objects;
DROP POLICY IF EXISTS "Chat: dono gerencia" ON storage.objects;

CREATE POLICY "Chat: participantes leem"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat'
    AND EXISTS (
      SELECT 1 FROM public.conversas c
      LEFT JOIN public.prestadores p ON p.id = c.prestador_id
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.cliente_id = auth.uid() OR p.profile_id = auth.uid())
    )
  );

CREATE POLICY "Chat: participantes enviam"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat'
    AND EXISTS (
      SELECT 1 FROM public.conversas c
      LEFT JOIN public.prestadores p ON p.id = c.prestador_id
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.cliente_id = auth.uid() OR p.profile_id = auth.uid())
    )
  );

CREATE POLICY "Chat: participantes gerenciam"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat'
    AND owner = auth.uid()
  );

-- 4. Lock down SECURITY DEFINER functions from anon/authenticated EXECUTE
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END$$;

-- Re-grant only the helper that RLS policies invoke as the caller
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prestador_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_prestador(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prestador_tem_proposta(uuid, uuid) TO authenticated;
