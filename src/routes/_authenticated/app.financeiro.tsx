import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, Wallet, CheckCircle2, Clock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyPrestador } from "@/lib/prestador";

export const Route = createFileRoute("/_authenticated/app/financeiro")({
  component: Financeiro,
});

function Financeiro() {
  const { user } = useAuth();
  const meQ = useQuery({
    queryKey: ["me-prestador", user?.id],
    enabled: !!user,
    queryFn: () => getMyPrestador(user!.id),
  });
  const prestadorId = meQ.data?.id;

  const q = useQuery({
    queryKey: ["financeiro", prestadorId],
    enabled: !!prestadorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id, status, valor_final, data_inicio, data_final, created_at, solicitacoes(titulo)")
        .eq("prestador_id", prestadorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const contratos = q.data ?? [];
  const concluidos = contratos.filter((c: any) => c.status === "concluido");
  const emAndamento = contratos.filter((c: any) => c.status === "em_andamento" || c.status === "ativo");
  const totalRecebido = concluidos.reduce((s, c: any) => s + Number(c.valor_final ?? 0), 0);
  const totalPrevisto = emAndamento.reduce((s, c: any) => s + Number(c.valor_final ?? 0), 0);
  const mesAtual = new Date();
  const doMes = concluidos.filter((c: any) => {
    const d = new Date(c.data_final ?? c.created_at);
    return d.getMonth() === mesAtual.getMonth() && d.getFullYear() === mesAtual.getFullYear();
  });
  const totalMes = doMes.reduce((s, c: any) => s + Number(c.valor_final ?? 0), 0);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <Link to="/app/painel" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Financeiro</h1>
      </header>

      <section className="mx-6 rounded-2xl bg-brand-gradient p-5 text-white shadow-soft">
        <p className="text-sm text-white/80">Total recebido</p>
        <p className="mt-1 text-3xl font-bold">R$ {totalRecebido.toFixed(2)}</p>
        <p className="mt-1 text-xs text-white/70">{concluidos.length} serviço(s) concluído(s)</p>
      </section>

      <section className="mx-6 grid grid-cols-2 gap-3">
        <Stat icon={TrendingUp} label="Este mês" value={`R$ ${totalMes.toFixed(2)}`} />
        <Stat icon={Clock} label="A receber" value={`R$ ${totalPrevisto.toFixed(2)}`} />
      </section>

      <section className="mx-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Últimos contratos</h2>
        {q.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />)
        ) : contratos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 font-medium">Sem contratos ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Envie propostas para começar a faturar.</p>
          </div>
        ) : (
          contratos.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.solicitacoes?.titulo ?? "Serviço"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")} · {c.status}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-success">R$ {Number(c.valor_final ?? 0).toFixed(2)}</p>
                {c.status === "concluido" && <CheckCircle2 className="ml-auto mt-1 h-4 w-4 text-success" />}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}