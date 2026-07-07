
REVOKE EXECUTE ON FUNCTION public.notificar_nova_proposta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.processar_resposta_proposta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_mensagem() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_status_documento() FROM PUBLIC, anon, authenticated;
