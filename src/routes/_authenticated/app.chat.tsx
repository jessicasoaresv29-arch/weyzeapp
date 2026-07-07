import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { fetchConversasDoUsuario, getMyPrestador } from "@/lib/prestador";

export const Route = createFileRoute("/_authenticated/app/chat")({
  component: ChatList,
});

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

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="px-6 pt-8">
        <h1 className="text-2xl font-bold">Conversas</h1>
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
              return (
                <li key={c.id}>
                  <Link to="/app/chat/$id" params={{ id: c.id }} className="flex items-center gap-3 p-3 transition-colors hover:bg-secondary">
                    {other?.foto_url
                      ? <img src={other.foto_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                      : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-white font-bold">{initial}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{other?.nome ?? "Usuário"}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.solicitacoes?.titulo ?? "Conversa"}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleDateString("pt-BR")}</span>
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