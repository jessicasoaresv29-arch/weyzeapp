
-- Add explicit FKs to public.profiles so PostgREST can embed profile data
ALTER TABLE public.solicitacoes
  ADD CONSTRAINT solicitacoes_cliente_profile_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.conversas
  ADD CONSTRAINT conversas_cliente_profile_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.mensagens
  ADD CONSTRAINT mensagens_remetente_profile_fkey
  FOREIGN KEY (remetente_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.avaliacoes
  ADD CONSTRAINT avaliacoes_cliente_profile_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_cliente_profile_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.notificacoes
  ADD CONSTRAINT notificacoes_usuario_profile_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.favoritos
  ADD CONSTRAINT favoritos_cliente_profile_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
