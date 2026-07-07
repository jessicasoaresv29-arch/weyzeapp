import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Clock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/solicitacoes")({
  component: Solicitacoes,
});

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  aberto: { text: "Aberto", color: "bg-primary/10 text-primary" },
  recebendo_propostas: { text: "Recebendo propostas", color: "bg-primary/10 text-primary" },
  aceito: { text: "Aceito", color: "bg-success/10 text-success" },
  em_andamento: { text: "Em andamento", color: "bg-amber-100 text-amber-700" },
  concluido: { text: "Concluído", color: "bg-muted text-muted-foreground" },
  cancelado: { text: "Cancelado", color: "bg-destructive/10 text-destructive" },
};

function Solicitacoes() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["minhas-solicitacoes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes")
        .select("id,titulo,descricao,status,urgencia,cidade,data_servico,created_at")
        .eq("cliente_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="px-6 pt-8">
        <h1 className="text-2xl font-bold">Meus pedidos</h1>
        <p className="text-sm text-muted-foreground">Acompanhe suas solicitações</p>
      </header>

      <div className="px-6">
        <Button asChild size="lg" className="h-12 w-full rounded-2xl bg-success text-success-foreground shadow-soft hover:bg-success/90">
          <Link to="/app/solicitar" search={{}}>
            <Plus className="h-5 w-5" /> Nova solicitação
          </Link>
        </Button>
      </div>

      <section className="space-y-3 px-6 pt-2">
        {q.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />)
        ) : (q.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">Nenhum pedido ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Toque em "Nova solicitação" para começar.</p>
          </div>
        ) : (
          (q.data ?? []).map((s) => {
            const st = STATUS_LABEL[s.status] ?? STATUS_LABEL.aberto;
            return (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-foreground">{s.titulo}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}>{st.text}</span>
                </div>
                {s.descricao && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.descricao}</p>}
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                  {s.cidade && <span>{s.cidade}</span>}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}