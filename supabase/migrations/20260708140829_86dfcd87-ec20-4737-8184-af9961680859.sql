DROP POLICY IF EXISTS "Cliente cria conversa" ON public.conversas;
DROP POLICY IF EXISTS "Participantes criam conversa" ON public.conversas;
CREATE POLICY "Participantes criam conversa"
ON public.conversas
FOR INSERT
TO authenticated
WITH CHECK (
  cliente_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.prestadores p
    WHERE p.id = conversas.prestador_id
      AND p.profile_id = auth.uid()
      AND conversas.solicitacao_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.solicitacoes s
        WHERE s.id = conversas.solicitacao_id
          AND s.cliente_id = conversas.cliente_id
      )
      AND EXISTS (
        SELECT 1
        FROM public.propostas pr
        WHERE pr.solicitacao_id = conversas.solicitacao_id
          AND pr.prestador_id = conversas.prestador_id
          AND pr.status IN ('enviada', 'aceita')
      )
  )
);