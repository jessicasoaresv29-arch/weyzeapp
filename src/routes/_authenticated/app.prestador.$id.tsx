import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Heart, MapPin, Star, MessageSquare, Share2, Phone } from "lucide-react";
import { toast } from "sonner";

import { fetchPrestadorById } from "@/lib/data";
import { iniciarConversa } from "@/lib/prestador";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/app/prestador/$id")({
  component: PrestadorPage,
});

function PrestadorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["prestador", id], queryFn: () => fetchPrestadorById(id) });

  const favQ = useQuery({
    queryKey: ["favorito", id, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("favoritos").select("id").eq("prestador_id", id).eq("cliente_id", user!.id).maybeSingle();
      return !!data;
    },
  });
  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (favQ.data) {
        await supabase.from("favoritos").delete().eq("prestador_id", id).eq("cliente_id", user.id);
      } else {
        await supabase.from("favoritos").insert({ prestador_id: id, cliente_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorito", id] }),
  });

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: q.data?.profiles?.nome ?? "Weyze", url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  }

  if (q.isLoading) {
    return <div className="p-6"><div className="h-40 animate-pulse rounded-2xl bg-secondary" /></div>;
  }
  const p = q.data as any;
  if (!p) return <div className="p-6 text-center text-muted-foreground">Prestador não encontrado.</div>;
  const profile = p.profiles;
  const initial = profile?.nome?.[0]?.toUpperCase() ?? "?";
  const categorias: { id: string; nome: string }[] = (p.prestador_categorias ?? [])
    .map((pc: any) => pc.categorias).filter(Boolean);
  const portfolio: { id: string; imagem_url: string; titulo: string | null }[] = p.portfolio ?? [];

  return (
    <div className="flex flex-col">
      <div className="relative bg-brand-gradient px-6 pb-8 pt-6">
        <div className="flex items-center justify-between text-white">
          <Link to="/app" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex gap-2">
            <button onClick={share} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <Share2 className="h-5 w-5" />
            </button>
            <button
              onClick={() => toggleFav.mutate()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur"
            >
              <Heart className={`h-5 w-5 ${favQ.data ? "fill-current" : ""}`} />
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center text-center text-white">
          {profile?.foto_url ? (
            <img src={profile.foto_url} alt="" className="h-24 w-24 rounded-full border-4 border-white/30 object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/30 bg-white/20 text-3xl font-bold">
              {initial}
            </div>
          )}
          <h1 className="mt-3 text-2xl font-bold">{profile?.nome}</h1>
          <p className="mt-1 text-sm text-white/80">{categorias.map((c) => c.nome).join(" · ") || "Prestador"}</p>
        </div>
      </div>

      <div className="-mt-6 grid grid-cols-3 gap-3 px-6">
        <Stat label="Avaliação" value={<span className="flex items-center gap-1"><Star className="h-4 w-4 fill-current text-amber-400" strokeWidth={0}/>{Number(p.nota_media).toFixed(1)}</span>} />
        <Stat label="Serviços" value={p.quantidade_avaliacoes} />
        <Stat label="Experiência" value={`${p.anos_experiencia ?? 0}a`} />
      </div>

      <section className="mt-6 space-y-5 px-6">
        {(p.descricao_profissional || profile?.descricao) && (
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sobre</h2>
            <p className="text-sm leading-relaxed text-foreground">{p.descricao_profissional ?? profile?.descricao}</p>
          </div>
        )}

        {profile?.cidade && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {profile.cidade}{profile.estado ? `, ${profile.estado}` : ""}
            {p.atende_domicilio && ` · Atende domicílio (${p.raio_atendimento_km ?? 20}km)`}
          </div>
        )}

        {profile?.telefone && (
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contato</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={`https://wa.me/${String(profile.telefone).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${profile.nome ?? ""}, encontrei seu perfil no Weyze e gostaria de contratar um serviço.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-card active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M20.52 3.48A11.87 11.87 0 0 0 12.06 0C5.5 0 .17 5.33.17 11.9a11.8 11.8 0 0 0 1.6 5.94L0 24l6.34-1.66a11.9 11.9 0 0 0 5.72 1.46h.01c6.55 0 11.89-5.33 11.89-11.9a11.83 11.83 0 0 0-3.44-8.42Zm-8.46 18.3h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.98 1-3.67-.24-.38a9.83 9.83 0 0 1-1.51-5.22c0-5.44 4.43-9.87 9.88-9.87 2.64 0 5.12 1.03 6.98 2.9a9.8 9.8 0 0 1 2.9 6.98c0 5.44-4.43 9.87-9.85 9.87Zm5.4-7.4c-.29-.14-1.75-.86-2.02-.96-.27-.1-.47-.14-.66.15-.2.29-.76.96-.93 1.16-.17.2-.34.22-.63.07-.29-.14-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.45.12-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.14-.66-1.6-.9-2.19-.24-.57-.48-.5-.66-.51h-.57c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44 0 1.44 1.05 2.83 1.2 3.02.15.2 2.07 3.16 5.02 4.43.7.3 1.25.48 1.68.62.7.22 1.34.19 1.84.11.56-.08 1.75-.72 2-1.42.25-.7.25-1.29.18-1.42-.07-.13-.27-.2-.56-.34Z"/>
                </svg>
                WhatsApp
              </a>
              <a
                href={`tel:${String(profile.telefone).replace(/\s/g, "")}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" /> {profile.telefone}
              </a>
            </div>
          </div>
        )}

        {portfolio.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Portfólio</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {portfolio.map((it) => (
                <img key={it.id} src={it.imagem_url} alt={it.titulo ?? ""} className="h-28 w-28 flex-shrink-0 rounded-xl object-cover" />
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="sticky bottom-24 mt-8 flex gap-3 px-6">
        <Button variant="outline" size="lg" className="h-14 flex-1 rounded-2xl"
          onClick={async () => {
            if (!user) return;
            try {
              const cid = await iniciarConversa(user.id, id, null);
              navigate({ to: "/app/chat/$id", params: { id: cid } });
            } catch (e: any) { toast.error(e.message ?? "Erro ao abrir conversa"); }
          }}>
          <MessageSquare className="h-5 w-5" /> Mensagem
        </Button>
        <Button
          size="lg"
          onClick={() => navigate({ to: "/app/solicitar", search: { prestador: id } })}
          className="h-14 flex-[2] rounded-2xl bg-success text-base font-semibold text-success-foreground shadow-soft hover:bg-success/90"
        >
          Solicitar serviço
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-card">
      <div className="text-base font-bold text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}