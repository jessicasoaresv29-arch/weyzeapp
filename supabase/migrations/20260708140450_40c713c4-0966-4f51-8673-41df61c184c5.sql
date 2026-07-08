REVOKE EXECUTE ON FUNCTION public.atualizar_conversa_ultima_msg() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_mensagem() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_conversa_ultima_msg() TO service_role;
GRANT EXECUTE ON FUNCTION public.notificar_mensagem() TO service_role;