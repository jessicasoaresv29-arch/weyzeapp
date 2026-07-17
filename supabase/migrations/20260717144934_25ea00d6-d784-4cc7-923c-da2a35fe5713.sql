
CREATE TABLE public.mp_test_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_ref TEXT NOT NULL UNIQUE,
  valor NUMERIC(12,2) NOT NULL,
  forma TEXT NOT NULL CHECK (forma IN ('pix','cartao')),
  status TEXT NOT NULL DEFAULT 'pendente',
  status_detail TEXT,
  mp_payment_id TEXT,
  preference_id TEXT,
  init_point TEXT,
  pix_qr_base64 TEXT,
  pix_copia_cola TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mp_test_payments TO authenticated;
GRANT ALL ON public.mp_test_payments TO service_role;
ALTER TABLE public.mp_test_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own test payments" ON public.mp_test_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own test payments" ON public.mp_test_payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mp_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref TEXT,
  mp_payment_id TEXT,
  status TEXT,
  status_detail TEXT,
  payload JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mp_webhook_log (external_ref);
GRANT SELECT ON public.mp_webhook_log TO authenticated;
GRANT ALL ON public.mp_webhook_log TO service_role;
ALTER TABLE public.mp_webhook_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read webhook log" ON public.mp_webhook_log
  FOR SELECT TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.mp_test_payments;
ALTER TABLE public.mp_test_payments REPLICA IDENTITY FULL;
