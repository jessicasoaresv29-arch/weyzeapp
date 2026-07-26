-- 1) Helper functions: self-scope so they cannot be used to probe other users
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _user_id IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_prestador_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _user_id IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN NULL
    ELSE (SELECT id FROM public.prestadores WHERE profile_id = _user_id LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_prestador(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _user_id IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN false
    ELSE EXISTS (SELECT 1 FROM public.prestadores WHERE profile_id = _user_id)
  END;
$$;

CREATE OR REPLACE FUNCTION public.prestador_tem_proposta(_solicitacao_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _user_id IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.propostas pr
      JOIN public.prestadores p ON p.id = pr.prestador_id
      WHERE pr.solicitacao_id = _solicitacao_id AND p.profile_id = _user_id
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_prestador_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_prestador(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prestador_tem_proposta(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prestador_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_prestador(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prestador_tem_proposta(uuid, uuid) TO authenticated;

-- 2) profiles: scope rows + hide email from other users
CREATE OR REPLACE FUNCTION public.pode_ver_perfil(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    auth.uid() = _profile_id
    OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.profile_id = _profile_id)
    OR EXISTS (
      SELECT 1 FROM public.conversas c
      LEFT JOIN public.prestadores pp ON pp.id = c.prestador_id
      WHERE (c.cliente_id = auth.uid() AND pp.profile_id = _profile_id)
         OR (pp.profile_id = auth.uid() AND c.cliente_id = _profile_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.contratos ct
      LEFT JOIN public.prestadores pp2 ON pp2.id = ct.prestador_id
      WHERE (ct.cliente_id = auth.uid() AND pp2.profile_id = _profile_id)
         OR (pp2.profile_id = auth.uid() AND ct.cliente_id = _profile_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.solicitacoes s
      WHERE s.cliente_id = _profile_id
        AND s.status IN ('aberto','recebendo_propostas')
        AND public.is_prestador(auth.uid())
    );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_ver_perfil(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_perfil(uuid) TO authenticated;

DROP POLICY IF EXISTS "Perfis visíveis a autenticados" ON public.profiles;
CREATE POLICY "Perfis visíveis a partes relacionadas"
ON public.profiles FOR SELECT TO authenticated
USING (public.pode_ver_perfil(id));

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, nome, telefone, foto_url, tipo_usuario, cidade, estado, descricao, verificado, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 3) avaliacoes: only the involved client and provider read full rows
DROP POLICY IF EXISTS "Avaliações visíveis a autenticados" ON public.avaliacoes;
CREATE POLICY "Avaliações visíveis às partes"
ON public.avaliacoes FOR SELECT TO authenticated
USING (
  cliente_id = auth.uid()
  OR prestador_id = public.get_prestador_id(auth.uid())
);