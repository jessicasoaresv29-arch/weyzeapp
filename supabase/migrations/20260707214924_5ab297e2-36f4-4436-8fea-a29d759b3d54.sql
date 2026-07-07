
-- Revoke SECURITY DEFINER execute from public roles (only service_role / triggers use them)
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atualizar_nota_prestador() FROM PUBLIC, anon, authenticated;
-- has_role is used inside RLS policies so authenticated must keep EXECUTE (stable, security definer, safe)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Storage RLS: avatars (users manage own; anyone signed-in can view)
CREATE POLICY "Avatars visíveis publicamente" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "Usuário envia próprio avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Usuário atualiza próprio avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Usuário deleta próprio avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Portfolio: public read, owner manages
CREATE POLICY "Portfolio visível publicamente" ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio');
CREATE POLICY "Prestador gerencia próprio portfolio storage" ON storage.objects FOR ALL
  USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Documentos: only owner + admin
CREATE POLICY "Documentos: dono visualiza" ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Documentos: dono gerencia" ON storage.objects FOR ALL
  USING (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Chat: only sender folder
CREATE POLICY "Chat: dono gerencia" ON storage.objects FOR ALL
  USING (bucket_id = 'chat' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'chat' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Chat: autenticado lê" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat' AND auth.role() = 'authenticated');
