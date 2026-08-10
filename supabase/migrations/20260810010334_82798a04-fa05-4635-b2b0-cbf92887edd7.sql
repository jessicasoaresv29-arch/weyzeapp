ALTER TABLE public.carteiras
  ADD COLUMN IF NOT EXISTS settlement_pending_balance NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'aguardando_liquidacao';