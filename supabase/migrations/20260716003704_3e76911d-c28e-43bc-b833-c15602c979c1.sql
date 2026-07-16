
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS mp_preference_id text,
  ADD COLUMN IF NOT EXISTS status_detail text,
  ADD COLUMN IF NOT EXISTS gateway_metadata jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS payments_mp_payment_id_key ON public.payments(mp_payment_id) WHERE mp_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.confirmar_pagamento_gateway(
  _payment_id uuid,
  _mp_payment_id text,
  _status_detail text,
  _metadata jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _p public.payments%ROWTYPE; _prof uuid;
BEGIN
  SELECT * INTO _p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado.'; END IF;
  IF _p.status = 'concluido' THEN RETURN; END IF;

  UPDATE public.payments
     SET status = 'concluido',
         paid_at = now(),
         mp_payment_id = COALESCE(_mp_payment_id, mp_payment_id),
         status_detail = _status_detail,
         gateway_metadata = COALESCE(_metadata, gateway_metadata),
         gateway_ref = COALESCE(_mp_payment_id, gateway_ref)
   WHERE id = _payment_id;

  PERFORM public._registrar_status_pagamento(_payment_id, 'concluido', 'Confirmado pelo Mercado Pago');
  PERFORM public._creditar_carteira(_p.prestador_id, _p.valor_liquido, _payment_id,
    'Recebimento ' || _p.forma::text || ' - ' || _p.codigo_transacao);
  UPDATE public.contratos SET status='pago', data_final = now() WHERE id = _p.contrato_id;

  SELECT profile_id INTO _prof FROM public.prestadores WHERE id = _p.prestador_id;
  IF _prof IS NOT NULL THEN
    PERFORM public.criar_notificacao(_prof, 'Pagamento recebido',
      'Você recebeu R$ ' || _p.valor_liquido::text || ' na sua carteira.',
      'pagamento', '/app/carteira');
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.confirmar_pagamento_gateway(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_gateway(uuid, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.registrar_gateway_ids(
  _payment_id uuid,
  _mp_payment_id text,
  _mp_preference_id text,
  _pix_qr_code text,
  _pix_copia_cola text,
  _metadata jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.payments
     SET mp_payment_id = COALESCE(_mp_payment_id, mp_payment_id),
         mp_preference_id = COALESCE(_mp_preference_id, mp_preference_id),
         pix_qr_code = COALESCE(_pix_qr_code, pix_qr_code),
         pix_copia_cola = COALESCE(_pix_copia_cola, pix_copia_cola),
         gateway = 'mercadopago',
         gateway_metadata = COALESCE(_metadata, gateway_metadata)
   WHERE id = _payment_id;
END; $$;

REVOKE ALL ON FUNCTION public.registrar_gateway_ids(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_gateway_ids(uuid, text, text, text, text, jsonb) TO service_role;
