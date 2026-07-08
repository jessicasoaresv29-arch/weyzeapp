-- Garante permissões de acesso via backend para o chat
GRANT SELECT, INSERT, UPDATE ON public.conversas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mensagens TO authenticated;
GRANT ALL ON public.conversas TO service_role;
GRANT ALL ON public.mensagens TO service_role;

-- Garante Realtime nas tabelas do chat sem falhar caso já esteja ativo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
  END IF;
END $$;

ALTER TABLE public.mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.conversas REPLICA IDENTITY FULL;

-- Função robusta para atualizar o resumo da conversa a cada mensagem
CREATE OR REPLACE FUNCTION public.atualizar_conversa_ultima_msg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.conversas
     SET ultima_mensagem_texto = COALESCE(
           NULLIF(LEFT(NEW.texto, 120), ''),
           CASE NEW.tipo
             WHEN 'localizacao' THEN '📍 Localização'
             WHEN 'contato' THEN '📞 Contato'
             WHEN 'sistema' THEN 'Atualização da negociação'
             ELSE 'Mensagem'
           END
         ),
         ultima_mensagem_at = COALESCE(NEW.created_at, now()),
         updated_at = COALESCE(NEW.created_at, now())
   WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$;

-- Função robusta para notificar o outro participante sem bloquear o envio caso a notificação falhe
CREATE OR REPLACE FUNCTION public.notificar_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cliente uuid;
  _prestador_profile uuid;
  _destino uuid;
  _preview text;
BEGIN
  SELECT c.cliente_id, p.profile_id
    INTO _cliente, _prestador_profile
    FROM public.conversas c
    JOIN public.prestadores p ON p.id = c.prestador_id
   WHERE c.id = NEW.conversa_id;

  IF _cliente IS NULL OR _prestador_profile IS NULL THEN
    RETURN NEW;
  END IF;

  _destino := CASE
    WHEN NEW.remetente_id = _cliente THEN _prestador_profile
    ELSE _cliente
  END;

  _preview := COALESCE(
    NULLIF(LEFT(NEW.texto, 80), ''),
    CASE NEW.tipo
      WHEN 'localizacao' THEN 'Localização compartilhada'
      WHEN 'contato' THEN 'Contato compartilhado'
      ELSE 'Nova mensagem'
    END
  );

  IF _destino IS NOT NULL AND _destino <> NEW.remetente_id THEN
    BEGIN
      PERFORM public.criar_notificacao(
        _destino,
        'Nova mensagem',
        _preview,
        'mensagem',
        '/app/chat/' || NEW.conversa_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- A mensagem não deve falhar por erro de notificação.
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensagens_snapshot ON public.mensagens;
CREATE TRIGGER trg_mensagens_snapshot
AFTER INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_conversa_ultima_msg();

DROP TRIGGER IF EXISTS trg_notificar_mensagem ON public.mensagens;
DROP TRIGGER IF EXISTS trg_mensagens_notificar ON public.mensagens;
CREATE TRIGGER trg_mensagens_notificar
AFTER INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.notificar_mensagem();

-- Recria políticas do chat de forma explícita para usuários autenticados
DROP POLICY IF EXISTS "Partes veem conversas" ON public.conversas;
CREATE POLICY "Partes veem conversas"
ON public.conversas
FOR SELECT
TO authenticated
USING (
  cliente_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.prestadores p
    WHERE p.id = conversas.prestador_id
      AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Cliente cria conversa" ON public.conversas;
CREATE POLICY "Cliente cria conversa"
ON public.conversas
FOR INSERT
TO authenticated
WITH CHECK (cliente_id = auth.uid());

DROP POLICY IF EXISTS "Partes atualizam conversa" ON public.conversas;
CREATE POLICY "Partes atualizam conversa"
ON public.conversas
FOR UPDATE
TO authenticated
USING (
  cliente_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.prestadores p
    WHERE p.id = conversas.prestador_id
      AND p.profile_id = auth.uid()
  )
)
WITH CHECK (
  cliente_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.prestadores p
    WHERE p.id = conversas.prestador_id
      AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Partes veem mensagens" ON public.mensagens;
CREATE POLICY "Partes veem mensagens"
ON public.mensagens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversas c
    WHERE c.id = mensagens.conversa_id
      AND (
        c.cliente_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.prestadores p
          WHERE p.id = c.prestador_id
            AND p.profile_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Partes enviam mensagens" ON public.mensagens;
CREATE POLICY "Partes enviam mensagens"
ON public.mensagens
FOR INSERT
TO authenticated
WITH CHECK (
  remetente_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversas c
    WHERE c.id = mensagens.conversa_id
      AND (
        c.cliente_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.prestadores p
          WHERE p.id = c.prestador_id
            AND p.profile_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Participantes marcam mensagens como lidas" ON public.mensagens;
CREATE POLICY "Participantes marcam mensagens como lidas"
ON public.mensagens
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversas c
    WHERE c.id = mensagens.conversa_id
      AND (
        c.cliente_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.prestadores p
          WHERE p.id = c.prestador_id
            AND p.profile_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.conversas c
    WHERE c.id = mensagens.conversa_id
      AND (
        c.cliente_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.prestadores p
          WHERE p.id = c.prestador_id
            AND p.profile_id = auth.uid()
        )
      )
  )
);

CREATE INDEX IF NOT EXISTS idx_conversas_cliente_updated ON public.conversas(cliente_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_prestador_updated ON public.conversas(prestador_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_created ON public.mensagens(conversa_id, created_at);