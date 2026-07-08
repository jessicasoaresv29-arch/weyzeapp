import { supabase } from "@/integrations/supabase/client";

export async function getMyPrestador(userId: string) {
  const { data } = await supabase
    .from("prestadores")
    .select("id, disponivel, descricao_profissional, anos_experiencia, valor_hora, raio_atendimento_km, atende_domicilio, prestador_categorias(categoria_id)")
    .eq("profile_id", userId)
    .maybeSingle();
  return data;
}

export async function ensurePrestador(userId: string) {
  const existing = await getMyPrestador(userId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("prestadores")
    .insert({ profile_id: userId, disponivel: false })
    .select("id, disponivel, descricao_profissional, anos_experiencia, valor_hora, raio_atendimento_km, atende_domicilio, prestador_categorias(categoria_id)")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSolicitacoesAbertas(_prestadorId: string, _categoriaIds: string[]) {
  // Todo prestador cadastrado vê todas as solicitações abertas.
  const { data, error } = await supabase
    .from("solicitacoes")
    .select("id, titulo, descricao, cidade, estado, urgencia, valor_estimado, data_servico, created_at, categoria_id, cliente_id, prestador_alvo_id, status, categorias(nome), profiles!solicitacoes_cliente_profile_fkey(nome, foto_url), propostas(id, prestador_id)")
    .in("status", ["aberto", "recebendo_propostas"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMinhasPropostas(prestadorId: string) {
  const { data, error } = await supabase
    .from("propostas")
    .select("id, valor, status, mensagem, created_at, solicitacao_id, solicitacoes(titulo, cidade, cliente_id)")
    .eq("prestador_id", prestadorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchConversasDoUsuario(userId: string, prestadorId: string | null) {
  const filter = prestadorId
    ? `cliente_id.eq.${userId},prestador_id.eq.${prestadorId}`
    : `cliente_id.eq.${userId}`;
  const { data, error } = await supabase
    .from("conversas")
    .select("id, cliente_id, prestador_id, solicitacao_id, updated_at, status_negociacao, ultima_mensagem_texto, ultima_mensagem_at, solicitacoes(titulo), prestadores(profile_id, profiles(nome, foto_url)), cliente:profiles!conversas_cliente_profile_fkey(nome, foto_url)")
    .or(filter)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return rows;
  // Contagem de não lidas por conversa (mensagens recebidas do outro)
  const ids = rows.map((r: any) => r.id);
  const { data: unread } = await supabase
    .from("mensagens")
    .select("conversa_id, remetente_id, lida")
    .in("conversa_id", ids)
    .eq("lida", false);
  const counts = new Map<string, number>();
  (unread ?? []).forEach((m: any) => {
    if (m.remetente_id !== userId) {
      counts.set(m.conversa_id, (counts.get(m.conversa_id) ?? 0) + 1);
    }
  });
  return rows.map((r: any) => ({ ...r, nao_lidas: counts.get(r.id) ?? 0 }));
}

export async function iniciarConversa(clienteId: string, prestadorId: string, solicitacaoId: string | null) {
  let query = supabase.from("conversas").select("id").eq("cliente_id", clienteId).eq("prestador_id", prestadorId);
  query = solicitacaoId ? query.eq("solicitacao_id", solicitacaoId) : query.is("solicitacao_id", null);
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("conversas")
    .insert({ cliente_id: clienteId, prestador_id: prestadorId, solicitacao_id: solicitacaoId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}