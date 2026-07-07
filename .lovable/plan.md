
# Weyze Connect — Plano de Construção

Projeto grande. Vou entregar em **fases incrementais**, cada uma funcional e testável, em vez de tentar tudo de uma vez (o que geraria código superficial e bugs).

Nesta aprovação, quero confirmar o **escopo da Fase 1** e a **ordem das fases**.

---

## Fase 1 — Fundação + Fluxo Cliente (esta entrega)

**Objetivo:** app navegável, com identidade Weyze, backend real e cliente conseguindo encontrar prestador e abrir solicitação.

1. **Design System Weyze**
   - Tokens em `src/styles.css`: azul #174EA6, verde #16C47F, cinzas, preto suave, cantos grandes, sombras suaves
   - Tipografia Inter, ícones Lucide, variantes shadcn (botão primário verde, secundário azul)
   - Logo Weyze integrada (usa a imagem enviada via Lovable Assets)
   - Mobile-first, bottom nav estilo app nativo

2. **Backend (Lovable Cloud / Supabase)** — migrations completas:
   - `profiles` (com `tipo_usuario`: cliente | prestador), `categorias` (seed com 20), `prestadores`, `prestador_categorias`, `portfolio`, `solicitacoes`, `propostas`, `contratos`, `conversas`, `mensagens`, `avaliacoes`, `favoritos`, `notificacoes`, `documentos`, `pesquisas_ia`
   - Enum `app_role` + tabela `user_roles` + função `has_role` (admin separado do `tipo_usuario`)
   - RLS em todas as tabelas + GRANTs corretos
   - Triggers: `updated_at`, auto-criar profile no signup, atualizar `nota_media`/`quantidade_avaliacoes`
   - Storage buckets: `avatars`, `portfolio`, `documentos`, `chat`
   - Índices para geolocalização (lat/lng) e busca

3. **Autenticação**
   - Email/senha + Google (via broker Lovable)
   - Onboarding: escolher Cliente ou Prestador
   - Rotas protegidas via `_authenticated/`
   - Recuperação de senha (`/reset-password`)

4. **Fluxo Cliente (essencial)**
   - Home: saudação, campo "O que você precisa hoje?", grid de categorias, prestadores próximos, mais bem avaliados
   - Busca por categoria/nome/cidade
   - Perfil público do prestador (foto, avaliação, portfolio, experiência)
   - Solicitar serviço (data, horário, endereço, descrição, fotos)
   - Lista "Minhas solicitações"
   - Favoritos

---

## Fases seguintes (confirmar ordem depois da Fase 1)

- **Fase 2 — Chat e Propostas:** conversas em tempo real (Realtime), envio de propostas, aceitar/recusar, criação de contrato, finalização, avaliação com estrelas
- **Fase 3 — Painel do Prestador:** dashboard, agenda, ganhos, gestão de solicitações recebidas, upload de documentos, portfolio
- **Fase 4 — Busca Inteligente com IA:** endpoint server function usando Lovable AI Gateway para interpretar texto livre → categoria + ranking de prestadores; entrada por voz (Web Speech API)
- **Fase 5 — Admin:** aprovar prestadores/documentos, gerenciar categorias, bloquear usuários, estatísticas
- **Fase 6 — Extras:** notificações push, modo escuro, denúncias, central de ajuda, compartilhar perfil, mapa Google

---

## Detalhes técnicos

- Stack: TanStack Start + React + Tailwind v4 + shadcn (já configurado)
- Backend: Lovable Cloud (Supabase gerenciado) — habilitado nesta fase
- Server functions (`createServerFn`) para lógica sensível; leituras públicas via cliente publishable
- `supabaseAdmin` só em webhooks/admin
- Google OAuth via `lovable.auth.signInWithOAuth`
- Nome da marca centralizado em `src/lib/brand.ts` (fácil renomear)

---

## O que preciso confirmar

1. **Aprovar Fase 1 como está** (fundação + cliente end-to-end até abrir solicitação) — ou prefere que eu inclua já o chat na Fase 1?
2. **Google Sign-In** agora ou só email/senha na Fase 1?
3. **Idioma:** só PT-BR (assumo que sim)?

Depois de aprovado, começo pela habilitação do Cloud + design system + migrations, tudo na sequência.
