
-- 1. Configurações parametrizáveis
CREATE TABLE IF NOT EXISTS public.configuracoes_plataforma (
  chave TEXT PRIMARY KEY,
  valor NUMERIC NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.configuracoes_plataforma TO authenticated;
GRANT ALL ON public.configuracoes_plataforma TO service_role;
ALTER TABLE public.configuracoes_plataforma ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_read_authenticated" ON public.configuracoes_plataforma FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_config_updated BEFORE UPDATE ON public.configuracoes_plataforma FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.configuracoes_plataforma (chave, valor, descricao)
VALUES ('comissao_percentual', 8, 'Percentual retido pela plataforma em cada pagamento')
ON CONFLICT (chave) DO NOTHING;

-- 2. Pagamentos
CREATE TABLE IF NOT EXISTS public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  status TEXT NOT NULL DEFAULT 'pendente',
  metodo TEXT NOT NULL,
  payment_type TEXT,
  payment_method TEXT,
  mp_payment_id TEXT UNIQUE,
  external_reference TEXT NOT NULL UNIQUE,
  qr_code TEXT,
  qr_code_base64 TEXT,
  ticket_url TEXT,
  expires_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  comissao_percentual NUMERIC(5,2) NOT NULL DEFAULT 8,
  valor_comissao NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_prestador NUMERIC(12,2) NOT NULL DEFAULT 0,
  detalhe_erro TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_contrato ON public.pagamentos(contrato_id);
-- Um único pagamento ativo (pendente/aprovado) por contrato: evita cobrança duplicada
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pagamento_ativo_contrato
  ON public.pagamentos(contrato_id) WHERE status IN ('pendente','aprovado');
GRANT SELECT ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pagamentos_select_partes" ON public.pagamentos FOR SELECT TO authenticated
USING (cliente_id = auth.uid() OR prestador_id = public.get_prestador_id(auth.uid()));
CREATE TRIGGER trg_pagamentos_updated BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Carteiras
CREATE TABLE IF NOT EXISTS public.carteiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL UNIQUE REFERENCES public.prestadores(id) ON DELETE CASCADE,
  available_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.carteiras TO authenticated;
GRANT ALL ON public.carteiras TO service_role;
ALTER TABLE public.carteiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carteiras_select_dono" ON public.carteiras FOR SELECT TO authenticated
USING (prestador_id = public.get_prestador_id(auth.uid()));
CREATE TRIGGER trg_carteiras_updated BEFORE UPDATE ON public.carteiras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Transações da carteira
CREATE TABLE IF NOT EXISTS public.carteira_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carteira_id UUID NOT NULL REFERENCES public.carteiras(id) ON DELETE CASCADE,
  pagamento_id UUID REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  tipo public.tipo_transacao_carteira NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  saldo_apos NUMERIC(12,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transacoes_carteira ON public.carteira_transacoes(carteira_id);
GRANT SELECT ON public.carteira_transacoes TO authenticated;
GRANT ALL ON public.carteira_transacoes TO service_role;
ALTER TABLE public.carteira_transacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transacoes_select_dono" ON public.carteira_transacoes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.carteiras c WHERE c.id = carteira_id AND c.prestador_id = public.get_prestador_id(auth.uid())));

-- 5. Saques (estrutura, sem integração bancária)
CREATE TABLE IF NOT EXISTS public.saques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carteira_id UUID NOT NULL REFERENCES public.carteiras(id) ON DELETE CASCADE,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  status TEXT NOT NULL DEFAULT 'solicitado',
  dados_bancarios JSONB,
  observacao TEXT,
  processado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.saques TO authenticated;
GRANT ALL ON public.saques TO service_role;
ALTER TABLE public.saques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saques_select_dono" ON public.saques FOR SELECT TO authenticated
USING (prestador_id = public.get_prestador_id(auth.uid()));
CREATE POLICY "saques_insert_dono" ON public.saques FOR INSERT TO authenticated
WITH CHECK (prestador_id = public.get_prestador_id(auth.uid()) AND status = 'solicitado');
CREATE TRIGGER trg_saques_updated BEFORE UPDATE ON public.saques FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Log de webhooks (idempotência)
CREATE TABLE IF NOT EXISTS public.mp_webhook_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id TEXT NOT NULL UNIQUE,
  topico TEXT,
  payload JSONB,
  processado BOOLEAN NOT NULL DEFAULT false,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.mp_webhook_eventos TO service_role;
ALTER TABLE public.mp_webhook_eventos ENABLE ROW LEVEL SECURITY;
