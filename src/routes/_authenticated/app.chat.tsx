import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { fetchConversasDoUsuario, getMyPrestador } from "@/lib/prestador";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/chat")({
  component: ChatList,
});

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function ChatList() {
  const { user } = useAuth();
  const [prestadorId, setPrestadorId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyPrestador(user.id).then((p) => setPrestadorId(p?.id ?? null));
  }, [user]);

  const q = useQuery({
    queryKey: ["conversas", user?.id, prestadorId],
    enabled: !!user,
    queryFn: () => fetchConversasDoUsuario(user!.id, prestadorId),
  });

  // Realtime: refetch quando conversas mudarem (nova msg atualiza updated_at)
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`chat-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas" }, () => q.refetch())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, () => q.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, q]);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="px-6 pt-8">
        <h1 className="text-2xl font-bold">Conversas</h1>
        <p className="text-sm text-muted-foreground">Negocie e feche seus serviços aqui.</p>
      </header>

      <section className="px-4">
        {q.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="mb-2 h-16 animate-pulse rounded-2xl bg-secondary" />)
        ) : (q.data ?? []).length === 0 ? (
          <div className="mx-2 rounded-2xl border border-dashed border-border p-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 font-medium">Nenhuma conversa ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Aceite ou receba uma proposta para começar.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {q.data!.map((c: any) => {
              const isCliente = c.cliente_id === user?.id;
              const other = isCliente ? c.prestadores?.profiles : c.cliente;
              const initial = other?.nome?.[0]?.toUpperCase() ?? "?";
              const unread = c.nao_lidas ?? 0;
              const preview = c.ultima_mensagem_texto || c.solicitacoes?.titulo || "Conversa";
              return (
                <li key={c.id}>
                  <Link to="/app/chat/$id" params={{ id: c.id }} className="flex items-center gap-3 p-3 transition-colors hover:bg-secondary">
                    {other?.foto_url
                      ? <img src={other.foto_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                      : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-white font-bold">{initial}</div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{other?.nome ?? "Usuário"}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatWhen(c.ultima_mensagem_at ?? c.updated_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-xs ${unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{preview}</p>
                        {unread > 0 && (
                          <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-success px-1.5 text-[10px] font-bold text-success-foreground">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
