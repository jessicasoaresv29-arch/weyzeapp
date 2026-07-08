
-- Chat: campos de status, snapshot da última mensagem, leitura
ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS status_negociacao text NOT NULL DEFAULT 'em_negociacao',
  ADD COLUMN IF NOT EXISTS ultima_mensagem_texto text,
  ADD COLUMN IF NOT EXISTS ultima_mensagem_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conversas_status_negociacao_check') THEN
    ALTER TABLE public.conversas
      ADD CONSTRAINT conversas_status_negociacao_check
      CHECK (status_negociacao IN ('em_negociacao','agendado','concluido','cancelado'));
  END IF;
END $$;

ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS lida_at timestamptz,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'texto';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mensagens_tipo_check') THEN
    ALTER TABLE public.mensagens
      ADD CONSTRAINT mensagens_tipo_check
      CHECK (tipo IN ('texto','localizacao','contato','sistema'));
  END IF;
END $$;

ALTER TABLE public.mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.conversas REPLICA IDENTITY FULL;

-- Garante publicação realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mensagens') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='conversas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
  END IF;
END $$;

-- Trigger: atualiza snapshot da conversa quando entra nova mensagem
CREATE OR REPLACE FUNCTION public.atualizar_conversa_ultima_msg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.conversas
    SET ultima_mensagem_texto = COALESCE(LEFT(NEW.texto, 120),
                                         CASE NEW.tipo
                                           WHEN 'localizacao' THEN '📍 Localização'
                                           WHEN 'contato' THEN '📞 Contato'
                                           ELSE '📎 Arquivo'
                                         END),
        ultima_mensagem_at = NEW.created_at,
        updated_at = NEW.created_at
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mensagens_snapshot ON public.mensagens;
CREATE TRIGGER trg_mensagens_snapshot
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.atualizar_conversa_ultima_msg();

-- Trigger de notificação por mensagem (função já existente)
DROP TRIGGER IF EXISTS trg_mensagens_notificar ON public.mensagens;
CREATE TRIGGER trg_mensagens_notificar
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.notificar_mensagem();

-- Permitir participantes marcarem mensagens do outro como lidas
DROP POLICY IF EXISTS "Participantes marcam mensagens como lidas" ON public.mensagens;
CREATE POLICY "Participantes marcam mensagens como lidas"
ON public.mensagens FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = mensagens.conversa_id
      AND (c.cliente_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = c.prestador_id AND p.profile_id = auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = mensagens.conversa_id
      AND (c.cliente_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = c.prestador_id AND p.profile_id = auth.uid()))
  )
);

-- Permitir participantes atualizarem status_negociacao
DROP POLICY IF EXISTS "Partes atualizam conversa" ON public.conversas;
CREATE POLICY "Partes atualizam conversa"
ON public.conversas FOR UPDATE
TO authenticated
USING (
  cliente_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = conversas.prestador_id AND p.profile_id = auth.uid())
)
WITH CHECK (
  cliente_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = conversas.prestador_id AND p.profile_id = auth.uid())
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_created ON public.mensagens(conversa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mensagens_nao_lidas ON public.mensagens(conversa_id, remetente_id) WHERE lida = false;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversas_cliente_prestador_solicitacao
  ON public.conversas(cliente_id, prestador_id, solicitacao_id)
  WHERE solicitacao_id IS NOT NULL;
