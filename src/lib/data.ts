import { supabase } from "@/integrations/supabase/client";

export type Categoria = {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  ordem: number;
};

export type PrestadorCard = {
  id: string;
  profile_id: string;
  nome: string;
  foto_url: string | null;
  cidade: string | null;
  estado: string | null;
  descricao_profissional: string | null;
  nota_media: number;
  quantidade_avaliacoes: number;
  disponivel: boolean;
  categorias: { id: string; nome: string }[];
};

export async function fetchCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from("categorias")
    .select("id,nome,icone,cor,ordem")
    .order("ordem", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTopPrestadores(limit = 10): Promise<PrestadorCard[]> {
  const { data, error } = await supabase
    .from("prestadores")
    .select(`
      id, profile_id, descricao_profissional, nota_media, quantidade_avaliacoes, disponivel,
      profiles!inner ( nome, foto_url, cidade, estado ),
      prestador_categorias ( categorias ( id, nome ) )
    `)
    .eq("disponivel", true)
    .order("nota_media", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    profile_id: p.profile_id,
    nome: p.profiles?.nome ?? "",
    foto_url: p.profiles?.foto_url ?? null,
    cidade: p.profiles?.cidade ?? null,
    estado: p.profiles?.estado ?? null,
    descricao_profissional: p.descricao_profissional,
    nota_media: Number(p.nota_media ?? 0),
    quantidade_avaliacoes: p.quantidade_avaliacoes ?? 0,
    disponivel: p.disponivel,
    categorias: (p.prestador_categorias ?? [])
      .map((pc: any) => pc.categorias)
      .filter(Boolean)
      .map((c: any) => ({ id: c.id, nome: c.nome })),
  }));
}

export async function fetchPrestadoresPorCategoria(categoriaId: string): Promise<PrestadorCard[]> {
  const { data, error } = await supabase
    .from("prestador_categorias")
    .select(`
      prestadores!inner (
        id, profile_id, descricao_profissional, nota_media, quantidade_avaliacoes, disponivel,
        profiles!inner ( nome, foto_url, cidade, estado ),
        prestador_categorias ( categorias ( id, nome ) )
      )
    `)
    .eq("categoria_id", categoriaId);
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => row.prestadores)
    .filter(Boolean)
    .map((p: any) => ({
      id: p.id,
      profile_id: p.profile_id,
      nome: p.profiles?.nome ?? "",
      foto_url: p.profiles?.foto_url ?? null,
      cidade: p.profiles?.cidade ?? null,
      estado: p.profiles?.estado ?? null,
      descricao_profissional: p.descricao_profissional,
      nota_media: Number(p.nota_media ?? 0),
      quantidade_avaliacoes: p.quantidade_avaliacoes ?? 0,
      disponivel: p.disponivel,
      categorias: (p.prestador_categorias ?? [])
        .map((pc: any) => pc.categorias)
        .filter(Boolean)
        .map((c: any) => ({ id: c.id, nome: c.nome })),
    }));
}

export async function fetchPrestadorById(id: string) {
  const { data, error } = await supabase
    .from("prestadores")
    .select(`
      id, profile_id, descricao_profissional, anos_experiencia, valor_hora,
      nota_media, quantidade_avaliacoes, disponivel, atende_domicilio, raio_atendimento_km,
      profiles!inner ( nome, foto_url, cidade, estado, telefone, descricao ),
      prestador_categorias ( categorias ( id, nome, icone ) ),
      portfolio ( id, imagem_url, titulo, descricao )
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchPrestadores(query: string): Promise<PrestadorCard[]> {
  const q = query.trim();
  if (!q) return fetchTopPrestadores(20);
  // Try match on profiles name/cidade and prestadores descricao
  const { data, error } = await supabase
    .from("prestadores")
    .select(`
      id, profile_id, descricao_profissional, nota_media, quantidade_avaliacoes, disponivel,
      profiles!inner ( nome, foto_url, cidade, estado ),
      prestador_categorias ( categorias ( id, nome ) )
    `)
    .or(`descricao_profissional.ilike.%${q}%`)
    .limit(50);
  if (error) throw error;
  const local = (data ?? []).filter((p: any) =>
    (p.profiles?.nome ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (p.profiles?.cidade ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (p.descricao_profissional ?? "").toLowerCase().includes(q.toLowerCase()),
  );
  return local.map((p: any) => ({
    id: p.id,
    profile_id: p.profile_id,
    nome: p.profiles?.nome ?? "",
    foto_url: p.profiles?.foto_url ?? null,
    cidade: p.profiles?.cidade ?? null,
    estado: p.profiles?.estado ?? null,
    descricao_profissional: p.descricao_profissional,
    nota_media: Number(p.nota_media ?? 0),
    quantidade_avaliacoes: p.quantidade_avaliacoes ?? 0,
    disponivel: p.disponivel,
    categorias: (p.prestador_categorias ?? [])
      .map((pc: any) => pc.categorias)
      .filter(Boolean)
      .map((c: any) => ({ id: c.id, nome: c.nome })),
  }));
}