
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.tipo_usuario AS ENUM ('cliente', 'prestador');
CREATE TYPE public.app_role AS ENUM ('admin', 'moderador', 'usuario');
CREATE TYPE public.status_solicitacao AS ENUM ('aberto', 'recebendo_propostas', 'aceito', 'em_andamento', 'concluido', 'cancelado');
CREATE TYPE public.status_proposta AS ENUM ('enviada', 'aceita', 'recusada', 'cancelada');
CREATE TYPE public.status_contrato AS ENUM ('ativo', 'concluido', 'cancelado');
CREATE TYPE public.status_documento AS ENUM ('pendente', 'aprovado', 'recusado');
CREATE TYPE public.urgencia AS ENUM ('baixa', 'media', 'alta');

-- =========================================================
-- HELPER FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  telefone TEXT,
  foto_url TEXT,
  tipo_usuario public.tipo_usuario NOT NULL DEFAULT 'cliente',
  cidade TEXT,
  estado TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  descricao TEXT,
  verificado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perfis são públicos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuário atualiza próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Usuário insere próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuário deleta próprio perfil" ON public.profiles FOR DELETE USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, tipo_usuario)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'tipo_usuario')::public.tipo_usuario, 'cliente')
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- USER ROLES (admin separado)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seus papéis" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- =========================================================
-- CATEGORIAS
-- =========================================================
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  icone TEXT NOT NULL DEFAULT 'wrench',
  cor TEXT NOT NULL DEFAULT '#174EA6',
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categorias TO anon, authenticated;
GRANT ALL ON public.categorias TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categorias públicas" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Admin gerencia categorias" ON public.categorias FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.categorias (nome, icone, ordem) VALUES
('Eletricista', 'zap', 1),
('Encanador', 'droplet', 2),
('Pintor', 'paint-roller', 3),
('Pedreiro', 'hammer', 4),
('Faxineira', 'sparkles', 5),
('Diarista', 'brush', 6),
('Marceneiro', 'axe', 7),
('Jardineiro', 'trees', 8),
('Ar Condicionado', 'snowflake', 9),
('Chaveiro', 'key', 10),
('Técnico de Informática', 'laptop', 11),
('Designer', 'palette', 12),
('Fotógrafo', 'camera', 13),
('Advogado', 'scale', 14),
('Contador', 'calculator', 15),
('Professor Particular', 'graduation-cap', 16),
('Mecânico', 'wrench', 17),
('Frete', 'truck', 18),
('Mudança', 'package', 19),
('Outros', 'more-horizontal', 99);

-- =========================================================
-- PRESTADORES
-- =========================================================
CREATE TABLE public.prestadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  descricao_profissional TEXT,
  anos_experiencia INT DEFAULT 0,
  valor_hora NUMERIC(10,2),
  nota_media NUMERIC(3,2) NOT NULL DEFAULT 0,
  quantidade_avaliacoes INT NOT NULL DEFAULT 0,
  disponivel BOOLEAN NOT NULL DEFAULT true,
  atende_domicilio BOOLEAN NOT NULL DEFAULT true,
  raio_atendimento_km INT DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prestadores TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.prestadores TO authenticated;
GRANT ALL ON public.prestadores TO service_role;
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prestadores públicos" ON public.prestadores FOR SELECT USING (true);
CREATE POLICY "Prestador gerencia próprio registro" ON public.prestadores FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE INDEX idx_prestadores_disponivel ON public.prestadores(disponivel);
CREATE INDEX idx_prestadores_nota ON public.prestadores(nota_media DESC);
CREATE TRIGGER trg_prestadores_updated BEFORE UPDATE ON public.prestadores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PRESTADOR_CATEGORIAS
-- =========================================================
CREATE TABLE public.prestador_categorias (
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (prestador_id, categoria_id)
);
GRANT SELECT ON public.prestador_categorias TO anon, authenticated;
GRANT INSERT, DELETE ON public.prestador_categorias TO authenticated;
GRANT ALL ON public.prestador_categorias TO service_role;
ALTER TABLE public.prestador_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Relação categorias pública" ON public.prestador_categorias FOR SELECT USING (true);
CREATE POLICY "Prestador gerencia próprias categorias" ON public.prestador_categorias FOR ALL
  USING (EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()));

-- =========================================================
-- PORTFOLIO
-- =========================================================
CREATE TABLE public.portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  imagem_url TEXT NOT NULL,
  titulo TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portfolio TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portfolio TO authenticated;
GRANT ALL ON public.portfolio TO service_role;
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portfolio público" ON public.portfolio FOR SELECT USING (true);
CREATE POLICY "Prestador gerencia próprio portfolio" ON public.portfolio FOR ALL
  USING (EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()));

-- =========================================================
-- SOLICITACOES
-- =========================================================
CREATE TABLE public.solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias(id),
  prestador_alvo_id UUID REFERENCES public.prestadores(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status public.status_solicitacao NOT NULL DEFAULT 'aberto',
  urgencia public.urgencia NOT NULL DEFAULT 'media',
  valor_estimado NUMERIC(10,2),
  data_servico TIMESTAMPTZ,
  fotos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes TO authenticated;
GRANT ALL ON public.solicitacoes TO service_role;
ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cliente vê próprias solicitações" ON public.solicitacoes FOR SELECT
  USING (auth.uid() = cliente_id OR EXISTS (
    SELECT 1 FROM public.prestadores p WHERE p.profile_id = auth.uid()
  ));
CREATE POLICY "Cliente cria solicitações" ON public.solicitacoes FOR INSERT WITH CHECK (auth.uid() = cliente_id);
CREATE POLICY "Cliente edita próprias solicitações" ON public.solicitacoes FOR UPDATE USING (auth.uid() = cliente_id);
CREATE POLICY "Cliente deleta próprias solicitações" ON public.solicitacoes FOR DELETE USING (auth.uid() = cliente_id);
CREATE INDEX idx_solicitacoes_cliente ON public.solicitacoes(cliente_id);
CREATE INDEX idx_solicitacoes_status ON public.solicitacoes(status);
CREATE INDEX idx_solicitacoes_categoria ON public.solicitacoes(categoria_id);
CREATE TRIGGER trg_solicitacoes_updated BEFORE UPDATE ON public.solicitacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PROPOSTAS
-- =========================================================
CREATE TABLE public.propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  mensagem TEXT,
  prazo_dias INT,
  status public.status_proposta NOT NULL DEFAULT 'enviada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas TO authenticated;
GRANT ALL ON public.propostas TO service_role;
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prestador vê próprias propostas" ON public.propostas FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.solicitacoes s WHERE s.id = solicitacao_id AND s.cliente_id = auth.uid()));
CREATE POLICY "Prestador cria propostas" ON public.propostas FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()));
CREATE POLICY "Prestador edita própria proposta" ON public.propostas FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()));
CREATE TRIGGER trg_propostas_updated BEFORE UPDATE ON public.propostas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- CONTRATOS
-- =========================================================
CREATE TABLE public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  solicitacao_id UUID REFERENCES public.solicitacoes(id) ON DELETE SET NULL,
  proposta_id UUID REFERENCES public.propostas(id) ON DELETE SET NULL,
  status public.status_contrato NOT NULL DEFAULT 'ativo',
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_final TIMESTAMPTZ,
  valor_final NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partes veem contratos" ON public.contratos FOR SELECT
  USING (auth.uid() = cliente_id OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()));
CREATE POLICY "Cliente cria contratos" ON public.contratos FOR INSERT WITH CHECK (auth.uid() = cliente_id);
CREATE POLICY "Partes atualizam contratos" ON public.contratos FOR UPDATE
  USING (auth.uid() = cliente_id OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()));
CREATE TRIGGER trg_contratos_updated BEFORE UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- CONVERSAS + MENSAGENS
-- =========================================================
CREATE TABLE public.conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  solicitacao_id UUID REFERENCES public.solicitacoes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, prestador_id, solicitacao_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas TO authenticated;
GRANT ALL ON public.conversas TO service_role;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partes veem conversas" ON public.conversas FOR SELECT
  USING (auth.uid() = cliente_id OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()));
CREATE POLICY "Cliente cria conversa" ON public.conversas FOR INSERT WITH CHECK (auth.uid() = cliente_id);

CREATE TABLE public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto TEXT,
  arquivo_url TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partes veem mensagens" ON public.mensagens FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = conversa_id AND (
      c.cliente_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = c.prestador_id AND p.profile_id = auth.uid())
    )
  ));
CREATE POLICY "Partes enviam mensagens" ON public.mensagens FOR INSERT
  WITH CHECK (auth.uid() = remetente_id AND EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = conversa_id AND (
      c.cliente_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = c.prestador_id AND p.profile_id = auth.uid())
    )
  ));
CREATE INDEX idx_mensagens_conversa ON public.mensagens(conversa_id, created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;

-- =========================================================
-- AVALIACOES
-- =========================================================
CREATE TABLE public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  nota INT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.avaliacoes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.avaliacoes TO authenticated;
GRANT ALL ON public.avaliacoes TO service_role;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avaliações públicas" ON public.avaliacoes FOR SELECT USING (true);
CREATE POLICY "Cliente cria avaliação" ON public.avaliacoes FOR INSERT WITH CHECK (auth.uid() = cliente_id);
CREATE POLICY "Cliente edita própria avaliação" ON public.avaliacoes FOR UPDATE USING (auth.uid() = cliente_id);
CREATE POLICY "Cliente deleta própria avaliação" ON public.avaliacoes FOR DELETE USING (auth.uid() = cliente_id);

CREATE OR REPLACE FUNCTION public.atualizar_nota_prestador()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prestador UUID;
BEGIN
  _prestador := COALESCE(NEW.prestador_id, OLD.prestador_id);
  UPDATE public.prestadores SET
    nota_media = COALESCE((SELECT ROUND(AVG(nota)::numeric, 2) FROM public.avaliacoes WHERE prestador_id = _prestador), 0),
    quantidade_avaliacoes = (SELECT COUNT(*) FROM public.avaliacoes WHERE prestador_id = _prestador)
  WHERE id = _prestador;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_avaliacoes_agg AFTER INSERT OR UPDATE OR DELETE ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_nota_prestador();

-- =========================================================
-- FAVORITOS
-- =========================================================
CREATE TABLE public.favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, prestador_id)
);
GRANT SELECT, INSERT, DELETE ON public.favoritos TO authenticated;
GRANT ALL ON public.favoritos TO service_role;
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cliente vê próprios favoritos" ON public.favoritos FOR SELECT USING (auth.uid() = cliente_id);
CREATE POLICY "Cliente adiciona favoritos" ON public.favoritos FOR INSERT WITH CHECK (auth.uid() = cliente_id);
CREATE POLICY "Cliente remove favoritos" ON public.favoritos FOR DELETE USING (auth.uid() = cliente_id);

-- =========================================================
-- NOTIFICACOES
-- =========================================================
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  tipo TEXT NOT NULL DEFAULT 'info',
  lida BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê próprias notificações" ON public.notificacoes FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "Usuário atualiza próprias notificações" ON public.notificacoes FOR UPDATE USING (auth.uid() = usuario_id);
CREATE POLICY "Usuário deleta próprias notificações" ON public.notificacoes FOR DELETE USING (auth.uid() = usuario_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- =========================================================
-- DOCUMENTOS
-- =========================================================
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  status public.status_documento NOT NULL DEFAULT 'pendente',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prestador vê próprios documentos" ON public.documentos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Prestador envia documentos" ON public.documentos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.prestadores p WHERE p.id = prestador_id AND p.profile_id = auth.uid()));
CREATE POLICY "Admin atualiza documentos" ON public.documentos FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_documentos_updated BEFORE UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PESQUISAS IA
-- =========================================================
CREATE TABLE public.pesquisas_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  texto_digitado TEXT NOT NULL,
  categoria_detectada UUID REFERENCES public.categorias(id),
  prestadores_encontrados JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pesquisas_ia TO authenticated;
GRANT ALL ON public.pesquisas_ia TO service_role;
ALTER TABLE public.pesquisas_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê próprias pesquisas" ON public.pesquisas_ia FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "Usuário cria pesquisas" ON public.pesquisas_ia FOR INSERT WITH CHECK (auth.uid() = usuario_id OR usuario_id IS NULL);
