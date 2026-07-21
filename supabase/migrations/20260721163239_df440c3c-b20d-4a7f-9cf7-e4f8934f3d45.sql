
-- Drop payment-related tables (cascade removes their policies, indexes, triggers)
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.cash_confirmations CASCADE;
DROP TABLE IF EXISTS public.payment_logs CASCADE;
DROP TABLE IF EXISTS public.payment_status_history CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.mp_webhook_log CASCADE;
DROP TABLE IF EXISTS public.mp_test_payments CASCADE;

-- Drop payment-only functions
DROP FUNCTION IF EXISTS public.iniciar_pagamento(uuid, forma_pagamento, integer) CASCADE;
DROP FUNCTION IF EXISTS public.confirmar_pagamento_mock(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.confirmar_pagamento_gateway(uuid, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.confirmar_dinheiro_cliente(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.confirmar_dinheiro_prestador(uuid) CASCADE;
DROP FUNCTION IF EXISTS public._finalizar_dinheiro_se_completo(uuid) CASCADE;
DROP FUNCTION IF EXISTS public._registrar_status_pagamento(uuid, status_pagamento, text) CASCADE;
DROP FUNCTION IF EXISTS public._garantir_wallet(uuid) CASCADE;
DROP FUNCTION IF EXISTS public._creditar_carteira(uuid, numeric, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.registrar_gateway_ids(uuid, text, text, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.abrir_disputa(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.concluir_servico(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.confirmar_conclusao_cliente(uuid) CASCADE;

-- Drop payment enums (no longer referenced by any table)
DROP TYPE IF EXISTS public.status_pagamento CASCADE;
DROP TYPE IF EXISTS public.forma_pagamento CASCADE;
