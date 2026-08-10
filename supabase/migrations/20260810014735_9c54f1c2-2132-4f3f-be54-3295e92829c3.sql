-- Garante que a função de mock de pagamento não exista mais
DROP FUNCTION IF EXISTS public.confirmar_pagamento_mock(uuid);
DROP FUNCTION IF EXISTS public.confirmar_pagamento_mock(_payment_id uuid);

-- Defense in depth: nenhuma função SECURITY DEFINER pode ser executada por anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_prestador(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_prestador_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prestador_tem_proposta(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_ver_perfil(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.criar_notificacao(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atualizar_conversa_ultima_msg() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atualizar_nota_prestador() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_solicitacao_aberta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_mensagem() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_nova_proposta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_status_documento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.processar_resposta_proposta() FROM PUBLIC, anon, authenticated;