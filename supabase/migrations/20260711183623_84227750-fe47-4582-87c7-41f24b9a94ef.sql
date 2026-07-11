
-- ==========================================
-- PAYMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  forma public.forma_pagamento NOT NULL,
  valor_bruto NUMERIC(12,2) NOT NULL CHECK (valor_bruto >= 0),
  taxa_percentual NUMERIC(5,2) NOT NULL DEFAULT 8.00,
  taxa_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.status_pagamento NOT NULL DEFAULT 'aguardando_pagamento',
  codigo_transacao TEXT NOT NULL UNIQUE DEFAULT ('WZ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  gateway TEXT,
  gateway_ref TEXT,
  pix_qr_code TEXT,
  pix_copia_cola TEXT,
  cartao_bandeira TEXT,
  cartao_last4 TEXT,
  parcelas INTEGER,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_contrato ON public.payments(contrato_id);
CREATE INDEX IF NOT EXISTS idx_payments_cliente ON public.payments(cliente_id);
CREATE INDEX IF NOT EXISTS idx_payments_prestador ON public.payments(prestador_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente ve seus pagamentos" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = cliente_id);
CREATE POLICY "prestador ve seus pagamentos" ON public.payments
  FOR SELECT TO authenticated USING (
    prestador_id IN (SELECT id FROM public.prestadores WHERE profile_id = auth.uid())
  );

CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- PAYMENT_STATUS_HISTORY
-- ==========================================
CREATE TABLE IF NOT EXISTS public.payment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  status_anterior public.status_pagamento,
  status_novo public.status_pagamento NOT NULL,
  motivo TEXT,
  ator UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_psh_payment ON public.payment_status_history(payment_id);
GRANT SELECT ON public.payment_status_history TO authenticated;
GRANT ALL ON public.payment_status_history TO service_role;
ALTER TABLE public.payment_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participantes veem historico" ON public.payment_status_history
  FOR SELECT TO authenticated USING (
    payment_id IN (
      SELECT id FROM public.payments
      WHERE cliente_id = auth.uid()
         OR prestador_id IN (SELECT id FROM public.prestadores WHERE profile_id = auth.uid())
    )
  );

-- ==========================================
-- PAYMENT_LOGS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  dados JSONB,
  ator UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plog_payment ON public.payment_logs(payment_id);
GRANT SELECT ON public.payment_logs TO authenticated;
GRANT ALL ON public.payment_logs TO service_role;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs visiveis participantes" ON public.payment_logs
  FOR SELECT TO authenticated USING (
    payment_id IS NULL OR payment_id IN (
      SELECT id FROM public.payments
      WHERE cliente_id = auth.uid()
         OR prestador_id IN (SELECT id FROM public.prestadores WHERE profile_id = auth.uid())
    )
  );

-- ==========================================
-- WALLETS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL UNIQUE REFERENCES public.prestadores(id) ON DELETE CASCADE,
  saldo_disponivel NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_pendente NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_recebido NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prestador ve sua carteira" ON public.wallets
  FOR SELECT TO authenticated USING (
    prestador_id IN (SELECT id FROM public.prestadores WHERE profile_id = auth.uid())
  );
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- WALLET_TRANSACTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  tipo public.tipo_transacao_carteira NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  saldo_apos NUMERIC(14,2) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wtx_wallet ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wtx_prestador ON public.wallet_transactions(prestador_id);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prestador ve seu extrato" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (
    prestador_id IN (SELECT id FROM public.prestadores WHERE profile_id = auth.uid())
  );

-- ==========================================
-- CASH_CONFIRMATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.cash_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  prestador_confirmou BOOLEAN NOT NULL DEFAULT FALSE,
  prestador_confirmou_at TIMESTAMPTZ,
  cliente_confirmou BOOLEAN NOT NULL DEFAULT FALSE,
  cliente_confirmou_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cash_confirmations TO authenticated;
GRANT ALL ON public.cash_confirmations TO service_role;
ALTER TABLE public.cash_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participantes veem confirmacao" ON public.cash_confirmations
  FOR SELECT TO authenticated USING (
    payment_id IN (
      SELECT id FROM public.payments
      WHERE cliente_id = auth.uid()
         OR prestador_id IN (SELECT id FROM public.prestadores WHERE profile_id = auth.uid())
    )
  );
CREATE TRIGGER trg_cash_updated BEFORE UPDATE ON public.cash_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- FUNÇÃO INTERNA: registrar mudança de status
-- ==========================================
CREATE OR REPLACE FUNCTION public._registrar_status_pagamento(
  _payment_id UUID, _novo public.status_pagamento, _motivo TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _atual public.status_pagamento;
BEGIN
  SELECT status INTO _atual FROM public.payments WHERE id = _payment_id;
  INSERT INTO public.payment_status_history(payment_id, status_anterior, status_novo, motivo, ator)
  VALUES (_payment_id, _atual, _novo, _motivo, auth.uid());
END; $$;
REVOKE EXECUTE ON FUNCTION public._registrar_status_pagamento(UUID, public.status_pagamento, TEXT) FROM PUBLIC, anon, authenticated;

-- ==========================================
-- FUNÇÃO INTERNA: garantir carteira
-- ==========================================
CREATE OR REPLACE FUNCTION public._garantir_wallet(_prestador_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _wid UUID;
BEGIN
  SELECT id INTO _wid FROM public.wallets WHERE prestador_id = _prestador_id;
  IF _wid IS NULL THEN
    INSERT INTO public.wallets(prestador_id) VALUES (_prestador_id) RETURNING id INTO _wid;
  END IF;
  RETURN _wid;
END; $$;
REVOKE EXECUTE ON FUNCTION public._garantir_wallet(UUID) FROM PUBLIC, anon, authenticated;

-- ==========================================
-- FUNÇÃO INTERNA: creditar carteira
-- ==========================================
CREATE OR REPLACE FUNCTION public._creditar_carteira(
  _prestador_id UUID, _valor NUMERIC, _payment_id UUID, _descricao TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _wid UUID; _novo NUMERIC;
BEGIN
  _wid := public._garantir_wallet(_prestador_id);
  UPDATE public.wallets
     SET saldo_disponivel = saldo_disponivel + _valor,
         total_recebido = total_recebido + _valor
   WHERE id = _wid
   RETURNING saldo_disponivel INTO _novo;
  INSERT INTO public.wallet_transactions(wallet_id, prestador_id, payment_id, tipo, valor, saldo_apos, descricao)
  VALUES (_wid, _prestador_id, _payment_id, 'credito', _valor, _novo, _descricao);
END; $$;
REVOKE EXECUTE ON FUNCTION public._creditar_carteira(UUID, NUMERIC, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ==========================================
-- RPC: concluir_servico (prestador)
-- ==========================================
CREATE OR REPLACE FUNCTION public.concluir_servico(_contrato_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.contratos%ROWTYPE; _prof UUID;
BEGIN
  SELECT * INTO _c FROM public.contratos WHERE id = _contrato_id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado.'; END IF;
  SELECT profile_id INTO _prof FROM public.prestadores WHERE id = _c.prestador_id;
  IF _prof <> auth.uid() THEN RAISE EXCEPTION 'Apenas o prestador pode concluir o serviço.'; END IF;
  IF _c.status NOT IN ('ativo','em_andamento') THEN
    RAISE EXCEPTION 'Contrato não pode ser concluído neste status: %', _c.status;
  END IF;
  UPDATE public.contratos SET status = 'aguardando_confirmacao_cliente' WHERE id = _contrato_id;
  PERFORM public.criar_notificacao(_c.cliente_id, 'Serviço concluído',
    'O prestador finalizou o serviço. Confirme para prosseguir com o pagamento.',
    'servico_concluido', '/app/contrato/' || _contrato_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.concluir_servico(UUID) TO authenticated;

-- ==========================================
-- RPC: confirmar_conclusao_cliente
-- ==========================================
CREATE OR REPLACE FUNCTION public.confirmar_conclusao_cliente(_contrato_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.contratos%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.contratos WHERE id = _contrato_id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado.'; END IF;
  IF _c.cliente_id <> auth.uid() THEN RAISE EXCEPTION 'Apenas o cliente pode confirmar.'; END IF;
  IF _c.status <> 'aguardando_confirmacao_cliente' THEN
    RAISE EXCEPTION 'Contrato não está aguardando confirmação.';
  END IF;
  UPDATE public.contratos SET status = 'aguardando_pagamento' WHERE id = _contrato_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.confirmar_conclusao_cliente(UUID) TO authenticated;

-- ==========================================
-- RPC: abrir_disputa
-- ==========================================
CREATE OR REPLACE FUNCTION public.abrir_disputa(_contrato_id UUID, _motivo TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.contratos%ROWTYPE; _prof UUID;
BEGIN
  SELECT * INTO _c FROM public.contratos WHERE id = _contrato_id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado.'; END IF;
  IF _c.cliente_id <> auth.uid() THEN RAISE EXCEPTION 'Apenas o cliente pode abrir disputa.'; END IF;
  UPDATE public.contratos SET status = 'disputado' WHERE id = _contrato_id;
  SELECT profile_id INTO _prof FROM public.prestadores WHERE id = _c.prestador_id;
  PERFORM public.criar_notificacao(_prof, 'Cliente reportou um problema',
    COALESCE(_motivo, 'Verifique o contrato.'), 'disputa', '/app/contrato/' || _contrato_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.abrir_disputa(UUID, TEXT) TO authenticated;

-- ==========================================
-- RPC: iniciar_pagamento
-- ==========================================
CREATE OR REPLACE FUNCTION public.iniciar_pagamento(
  _contrato_id UUID, _forma public.forma_pagamento, _parcelas INT DEFAULT 1
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _c public.contratos%ROWTYPE;
  _payment_id UUID;
  _existing UUID;
  _valor NUMERIC; _taxa NUMERIC; _liquido NUMERIC;
  _status public.status_pagamento;
BEGIN
  SELECT * INTO _c FROM public.contratos WHERE id = _contrato_id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado.'; END IF;
  IF _c.cliente_id <> auth.uid() THEN RAISE EXCEPTION 'Apenas o cliente pode iniciar o pagamento.'; END IF;
  IF _c.status <> 'aguardando_pagamento' THEN
    RAISE EXCEPTION 'Contrato não está aguardando pagamento.';
  END IF;
  IF _c.valor_final IS NULL OR _c.valor_final <= 0 THEN
    RAISE EXCEPTION 'Contrato sem valor definido.';
  END IF;

  -- reaproveita pagamento pendente se existir
  SELECT id INTO _existing FROM public.payments
   WHERE contrato_id = _contrato_id
     AND status IN ('aguardando_pagamento','pendente','dinheiro_pendente');
  IF _existing IS NOT NULL THEN
    UPDATE public.payments
       SET forma = _forma,
           parcelas = CASE WHEN _forma='credito' THEN GREATEST(_parcelas,1) ELSE NULL END,
           pix_qr_code = CASE WHEN _forma='pix' THEN '00020126' || substr(md5(random()::text),1,40) ELSE NULL END,
           pix_copia_cola = CASE WHEN _forma='pix' THEN '00020126' || substr(md5(random()::text),1,58) || '5204000053039865802BR' ELSE NULL END,
           status = CASE WHEN _forma='dinheiro' THEN 'dinheiro_pendente'::public.status_pagamento
                         ELSE 'aguardando_pagamento'::public.status_pagamento END
     WHERE id = _existing;
    -- garante cash_confirmations
    IF _forma = 'dinheiro' THEN
      INSERT INTO public.cash_confirmations(payment_id) VALUES (_existing) ON CONFLICT DO NOTHING;
    END IF;
    RETURN _existing;
  END IF;

  _valor := _c.valor_final;
  _taxa := ROUND(_valor * 0.08, 2);
  _liquido := _valor - _taxa;
  _status := CASE WHEN _forma='dinheiro' THEN 'dinheiro_pendente'::public.status_pagamento
                  ELSE 'aguardando_pagamento'::public.status_pagamento END;

  INSERT INTO public.payments(
    contrato_id, cliente_id, prestador_id, forma,
    valor_bruto, taxa_percentual, taxa_valor, valor_liquido, status,
    gateway, parcelas, pix_qr_code, pix_copia_cola
  ) VALUES (
    _contrato_id, _c.cliente_id, _c.prestador_id, _forma,
    _valor, 8.00, _taxa, _liquido, _status,
    CASE WHEN _forma IN ('pix','credito','debito') THEN 'mock' ELSE NULL END,
    CASE WHEN _forma='credito' THEN GREATEST(_parcelas,1) ELSE NULL END,
    CASE WHEN _forma='pix' THEN '00020126' || substr(md5(random()::text),1,40) ELSE NULL END,
    CASE WHEN _forma='pix' THEN '00020126' || substr(md5(random()::text),1,58) || '5204000053039865802BR' ELSE NULL END
  ) RETURNING id INTO _payment_id;

  PERFORM public._registrar_status_pagamento(_payment_id, _status, 'Pagamento iniciado');
  INSERT INTO public.payment_logs(payment_id, evento, dados, ator)
  VALUES (_payment_id, 'iniciar_pagamento', jsonb_build_object('forma',_forma,'valor',_valor), auth.uid());

  IF _forma = 'dinheiro' THEN
    INSERT INTO public.cash_confirmations(payment_id) VALUES (_payment_id);
  END IF;
  RETURN _payment_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.iniciar_pagamento(UUID, public.forma_pagamento, INT) TO authenticated;

-- ==========================================
-- RPC: confirmar_pagamento_mock (simula gateway PIX/cartão)
-- ==========================================
CREATE OR REPLACE FUNCTION public.confirmar_pagamento_mock(_payment_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.payments%ROWTYPE; _prof UUID;
BEGIN
  SELECT * INTO _p FROM public.payments WHERE id = _payment_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado.'; END IF;
  IF _p.cliente_id <> auth.uid() THEN RAISE EXCEPTION 'Apenas o cliente pode confirmar.'; END IF;
  IF _p.forma = 'dinheiro' THEN RAISE EXCEPTION 'Use as funções de dinheiro.'; END IF;
  IF _p.status NOT IN ('aguardando_pagamento','pendente') THEN
    RAISE EXCEPTION 'Pagamento não está aguardando confirmação.';
  END IF;

  UPDATE public.payments
     SET status = 'concluido',
         paid_at = now(),
         gateway_ref = 'MOCK-' || substr(md5(random()::text),1,16)
   WHERE id = _payment_id;

  PERFORM public._registrar_status_pagamento(_payment_id, 'concluido', 'Confirmado (mock)');
  PERFORM public._creditar_carteira(_p.prestador_id, _p.valor_liquido, _payment_id,
    'Recebimento ' || _p.forma::text || ' - ' || _p.codigo_transacao);
  UPDATE public.contratos SET status='pago', data_final = now() WHERE id = _p.contrato_id;

  SELECT profile_id INTO _prof FROM public.prestadores WHERE id = _p.prestador_id;
  PERFORM public.criar_notificacao(_prof, 'Pagamento recebido',
    'Você recebeu R$ ' || _p.valor_liquido::text || ' na sua carteira.',
    'pagamento', '/app/carteira');
END; $$;
GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_mock(UUID) TO authenticated;

-- ==========================================
-- RPC: confirmar dinheiro (prestador / cliente)
-- ==========================================
CREATE OR REPLACE FUNCTION public.confirmar_dinheiro_prestador(_payment_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.payments%ROWTYPE; _prof UUID;
BEGIN
  SELECT * INTO _p FROM public.payments WHERE id = _payment_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado.'; END IF;
  IF _p.forma <> 'dinheiro' THEN RAISE EXCEPTION 'Pagamento não é em dinheiro.'; END IF;
  SELECT profile_id INTO _prof FROM public.prestadores WHERE id = _p.prestador_id;
  IF _prof <> auth.uid() THEN RAISE EXCEPTION 'Apenas o prestador pode confirmar.'; END IF;
  UPDATE public.cash_confirmations
     SET prestador_confirmou = TRUE, prestador_confirmou_at = now()
   WHERE payment_id = _payment_id;
  PERFORM public._finalizar_dinheiro_se_completo(_payment_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.confirmar_dinheiro_prestador(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_dinheiro_cliente(_payment_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.payments%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.payments WHERE id = _payment_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado.'; END IF;
  IF _p.forma <> 'dinheiro' THEN RAISE EXCEPTION 'Pagamento não é em dinheiro.'; END IF;
  IF _p.cliente_id <> auth.uid() THEN RAISE EXCEPTION 'Apenas o cliente pode confirmar.'; END IF;
  UPDATE public.cash_confirmations
     SET cliente_confirmou = TRUE, cliente_confirmou_at = now()
   WHERE payment_id = _payment_id;
  PERFORM public._finalizar_dinheiro_se_completo(_payment_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.confirmar_dinheiro_cliente(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public._finalizar_dinheiro_se_completo(_payment_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cc public.cash_confirmations%ROWTYPE; _p public.payments%ROWTYPE;
BEGIN
  SELECT * INTO _cc FROM public.cash_confirmations WHERE payment_id = _payment_id;
  IF NOT (_cc.prestador_confirmou AND _cc.cliente_confirmou) THEN RETURN; END IF;
  SELECT * INTO _p FROM public.payments WHERE id = _payment_id;
  IF _p.status = 'concluido' THEN RETURN; END IF;
  UPDATE public.payments SET status='concluido', paid_at = now() WHERE id = _payment_id;
  PERFORM public._registrar_status_pagamento(_payment_id, 'concluido', 'Dinheiro confirmado por ambos');
  UPDATE public.contratos SET status='pago', data_final = now() WHERE id = _p.contrato_id;
  -- dinheiro não credita saldo digital, mas registra transação para o extrato
  PERFORM public._garantir_wallet(_p.prestador_id);
  INSERT INTO public.wallet_transactions(wallet_id, prestador_id, payment_id, tipo, valor, saldo_apos, descricao)
  SELECT id, _p.prestador_id, _payment_id, 'credito', 0,
         (SELECT saldo_disponivel FROM public.wallets WHERE prestador_id = _p.prestador_id),
         'Recebimento em dinheiro - ' || _p.codigo_transacao
    FROM public.wallets WHERE prestador_id = _p.prestador_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public._finalizar_dinheiro_se_completo(UUID) FROM PUBLIC, anon, authenticated;

-- ==========================================
-- REALTIME
-- ==========================================
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.cash_confirmations REPLICA IDENTITY FULL;
ALTER TABLE public.wallets REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_confirmations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
