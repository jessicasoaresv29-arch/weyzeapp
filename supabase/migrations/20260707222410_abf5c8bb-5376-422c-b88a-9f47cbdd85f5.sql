
-- =========================================================
-- Ajustar policies
-- =========================================================
DROP POLICY IF EXISTS "Cliente vê próprias solicitações" ON public.solicitacoes;
CREATE POLICY "Cliente vê próprias solicitações" ON public.solicitacoes FOR SELECT
  USING (
    auth.uid() = cliente_id
    OR (
      status IN ('aberto','recebendo_propostas')
      AND EXISTS (SELECT 1 FROM public.prestadores p WHERE p.profile_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.prestadores p
      WHERE p.profile_id = auth.uid() AND p.id = solicitacoes.prestador_alvo_id
    )
    OR EXISTS (
      SELECT 1 FROM public.propostas pr
      JOIN public.prestadores p ON p.id = pr.prestador_id
      WHERE pr.solicitacao_id = solicitacoes.id AND p.profile_id = auth.uid()
    )
  );

-- Cliente pode aceitar/recusar propostas
CREATE POLICY "Cliente responde propostas" ON public.propostas FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.solicitacoes s WHERE s.id = solicitacao_id AND s.cliente_id = auth.uid()));

-- =========================================================
-- Notificações: helper para inserir bypassando RLS
-- =========================================================
CREATE OR REPLACE FUNCTION public.criar_notificacao(_usuario UUID, _titulo TEXT, _msg TEXT, _tipo TEXT, _link TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notificacoes (usuario_id, titulo, mensagem, tipo, link)
  VALUES (_usuario, _titulo, _msg, _tipo, _link);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.criar_notificacao(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;

-- Trigger: nova proposta -> notifica cliente
CREATE OR REPLACE FUNCTION public.notificar_nova_proposta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cliente UUID;
BEGIN
  SELECT cliente_id INTO _cliente FROM public.solicitacoes WHERE id = NEW.solicitacao_id;
  IF _cliente IS NOT NULL THEN
    PERFORM public.criar_notificacao(_cliente, 'Nova proposta recebida', 'Você recebeu uma nova proposta para seu pedido.', 'proposta', '/app/solicitacoes');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notif_nova_proposta AFTER INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.notificar_nova_proposta();

-- Trigger: proposta aceita -> cria contrato + conversa + recusa outras + atualiza solicitação
CREATE OR REPLACE FUNCTION public.processar_resposta_proposta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cliente UUID; _prestador_profile UUID; _conversa UUID;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT cliente_id INTO _cliente FROM public.solicitacoes WHERE id = NEW.solicitacao_id;
  SELECT profile_id INTO _prestador_profile FROM public.prestadores WHERE id = NEW.prestador_id;

  IF NEW.status = 'aceita' THEN
    -- cria contrato
    INSERT INTO public.contratos (cliente_id, prestador_id, solicitacao_id, proposta_id, valor_final)
    VALUES (_cliente, NEW.prestador_id, NEW.solicitacao_id, NEW.id, NEW.valor);

    -- cria/garante conversa
    INSERT INTO public.conversas (cliente_id, prestador_id, solicitacao_id)
    VALUES (_cliente, NEW.prestador_id, NEW.solicitacao_id)
    ON CONFLICT (cliente_id, prestador_id, solicitacao_id) DO NOTHING;

    -- recusa outras propostas
    UPDATE public.propostas SET status = 'recusada'
      WHERE solicitacao_id = NEW.solicitacao_id AND id <> NEW.id AND status = 'enviada';

    -- atualiza status da solicitação
    UPDATE public.solicitacoes SET status = 'aceito' WHERE id = NEW.solicitacao_id;

    -- notifica prestador
    IF _prestador_profile IS NOT NULL THEN
      PERFORM public.criar_notificacao(_prestador_profile, 'Proposta aceita!', 'O cliente aceitou sua proposta. Comece o atendimento.', 'proposta_aceita', '/app/chat');
    END IF;
  ELSIF NEW.status = 'recusada' AND _prestador_profile IS NOT NULL THEN
    PERFORM public.criar_notificacao(_prestador_profile, 'Proposta recusada', 'O cliente não aceitou sua proposta desta vez.', 'proposta_recusada', '/app/painel');
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_processar_resposta_proposta AFTER UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.processar_resposta_proposta();

-- Trigger: nova mensagem -> notifica o outro lado + atualiza updated_at da conversa
CREATE OR REPLACE FUNCTION public.notificar_mensagem()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cliente UUID; _prestador_profile UUID; _destino UUID;
BEGIN
  SELECT c.cliente_id, p.profile_id
    INTO _cliente, _prestador_profile
    FROM public.conversas c JOIN public.prestadores p ON p.id = c.prestador_id
    WHERE c.id = NEW.conversa_id;

  _destino := CASE WHEN NEW.remetente_id = _cliente THEN _prestador_profile ELSE _cliente END;
  IF _destino IS NOT NULL AND _destino <> NEW.remetente_id THEN
    PERFORM public.criar_notificacao(_destino, 'Nova mensagem', COALESCE(LEFT(NEW.texto, 80), 'Arquivo enviado'), 'mensagem', '/app/chat/' || NEW.conversa_id);
  END IF;

  UPDATE public.conversas SET updated_at = now() WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notificar_mensagem AFTER INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.notificar_mensagem();

-- Trigger: documento aprovado/recusado -> notifica prestador
CREATE OR REPLACE FUNCTION public.notificar_status_documento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _profile UUID;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT profile_id INTO _profile FROM public.prestadores WHERE id = NEW.prestador_id;
  IF _profile IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'aprovado' THEN
    PERFORM public.criar_notificacao(_profile, 'Documento aprovado', 'Seu documento foi verificado com sucesso.', 'documento', '/app/painel');
    UPDATE public.profiles SET verificado = true WHERE id = _profile;
  ELSIF NEW.status = 'recusado' THEN
    PERFORM public.criar_notificacao(_profile, 'Documento recusado', COALESCE(NEW.observacao, 'Envie novamente um documento válido.'), 'documento', '/app/painel');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notificar_status_documento AFTER UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.notificar_status_documento();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.propostas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes;
