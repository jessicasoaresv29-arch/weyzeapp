
-- ==========================================
-- ENUMS
-- ==========================================
ALTER TYPE public.status_contrato ADD VALUE IF NOT EXISTS 'em_andamento';
ALTER TYPE public.status_contrato ADD VALUE IF NOT EXISTS 'aguardando_confirmacao_cliente';
ALTER TYPE public.status_contrato ADD VALUE IF NOT EXISTS 'aguardando_pagamento';
ALTER TYPE public.status_contrato ADD VALUE IF NOT EXISTS 'pago';
ALTER TYPE public.status_contrato ADD VALUE IF NOT EXISTS 'disputado';

DO $$ BEGIN
  CREATE TYPE public.forma_pagamento AS ENUM ('pix','credito','debito','dinheiro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_pagamento AS ENUM (
    'aguardando_pagamento','pendente','aprovado','recusado',
    'dinheiro_pendente','concluido','em_analise','estornado','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_transacao_carteira AS ENUM ('credito','debito','saque','estorno','ajuste');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
