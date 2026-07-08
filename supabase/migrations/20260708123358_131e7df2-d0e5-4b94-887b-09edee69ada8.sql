
-- 1. Security-definer helpers para eliminar recursão em políticas RLS
CREATE OR REPLACE FUNCTION public.get_prestador_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.prestadores WHERE profile_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_prestador(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.prestadores WHERE profile_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.prestador_tem_proposta(_solicitacao_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.propostas pr
    JOIN public.prestadores p ON p.id = pr.prestador_id
    WHERE pr.solicitacao_id = _solicitacao_id AND p.profile_id = _user_id
  );
$$;

-- 2. Solicitacoes SELECT sem recursão + visível a todos prestadores
DROP POLICY IF EXISTS "Cliente vê próprias solicitações" ON public.solicitacoes;
CREATE POLICY "Solicitacoes visíveis a partes"
ON public.solicitacoes FOR SELECT
USING (
  auth.uid() = cliente_id
  OR (status IN ('aberto','recebendo_propostas') AND public.is_prestador(auth.uid()))
  OR prestador_alvo_id = public.get_prestador_id(auth.uid())
  OR public.prestador_tem_proposta(id, auth.uid())
);

-- 3. Propostas SELECT sem recursão
DROP POLICY IF EXISTS "Prestador vê próprias propostas" ON public.propostas;
CREATE POLICY "Propostas visíveis a partes"
ON public.propostas FOR SELECT
USING (
  prestador_id = public.get_prestador_id(auth.uid())
  OR EXISTS (SELECT 1 FROM public.solicitacoes s WHERE s.id = propostas.solicitacao_id AND s.cliente_id = auth.uid())
);

-- 4. Garantir que documentos permite INSERT do dono (reforço)
DROP POLICY IF EXISTS "Prestador envia documentos" ON public.documentos;
CREATE POLICY "Prestador envia documentos"
ON public.documentos FOR INSERT TO authenticated
WITH CHECK (prestador_id = public.get_prestador_id(auth.uid()));

DROP POLICY IF EXISTS "Prestador vê próprios documentos" ON public.documentos;
CREATE POLICY "Prestador vê próprios documentos"
ON public.documentos FOR SELECT TO authenticated
USING (prestador_id = public.get_prestador_id(auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- 5. Fase 3 — tabela de agenda (bloqueios / disponibilidade)
CREATE TABLE IF NOT EXISTS public.agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora_inicio time,
  hora_fim time,
  tipo text NOT NULL DEFAULT 'bloqueio',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda TO authenticated;
GRANT ALL ON public.agenda TO service_role;

ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prestador gerencia própria agenda"
ON public.agenda FOR ALL TO authenticated
USING (prestador_id = public.get_prestador_id(auth.uid()))
WITH CHECK (prestador_id = public.get_prestador_id(auth.uid()));

CREATE INDEX IF NOT EXISTS agenda_prestador_data_idx ON public.agenda(prestador_id, data);
