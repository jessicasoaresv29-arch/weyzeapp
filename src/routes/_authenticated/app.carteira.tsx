import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, TrendingUp, Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyPrestador } from "@/lib/prestador";
import { getExtrato, getWallet } from "@/lib/payments";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app/carteira")({
  component: Carteira,
});

function Carteira() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ["me-prestador", user?.id], enabled: !!user, queryFn: () => getMyPrestador(user!.id) });
  const prestadorId = (meQ.data as any)?.id as string | undefined;
  const walletQ = useQuery({ queryKey: ["wallet", prestadorId], enabled: !!prestadorId, queryFn: () => getWallet(prestadorId!) });
  const extratoQ = useQuery({ queryKey: ["extrato", prestadorId], enabled: !!prestadorId, queryFn: () => getExtrato(prestadorId!) });

  useEffect(() => {
    if (!prestadorId) return;
    const ch = supabase.channel(`wallet-${prestadorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `prestador_id=eq.${prestadorId}` },
        () => qc.invalidateQueries({ queryKey: ["wallet", prestadorId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `prestador_id=eq.${prestadorId}` },
        () => qc.invalidateQueries({ queryKey: ["extrato", prestadorId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [prestadorId, qc]);

  const w: any = walletQ.data ?? { saldo_disponivel: 0, saldo_pendente: 0, total_recebido: 0 };
  const tx: any[] = extratoQ.data ?? [];

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const totalHoje = tx.filter(t => t.tipo === "credito" && new Date(t.created_at) >= hoje).reduce((s,t)=>s+Number(t.valor||0),0);
  const totalMes = tx.filter(t => t.tipo === "credito" && new Date(t.created_at) >= inicioMes).reduce((s,t)=>s+Number(t.valor||0),0);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <Link to="/app/painel" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Minha Carteira</h1>
      </header>

      <section className="mx-6 rounded-2xl bg-brand-gradient p-5 text-white shadow-soft">
        <p className="text-sm text-white/80">Saldo disponível</p>
        <p className="mt-1 text-3xl font-bold">R$ {Number(w.saldo_disponivel).toFixed(2)}</p>
        <div className="mt-3 flex justify-between text-xs text-white/80">
          <span>Pendente</span><span>R$ {Number(w.saldo_pendente).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs text-white/80">
          <span>Total recebido</span><span>R$ {Number(w.total_recebido).toFixed(2)}</span>
        </div>
      </section>

      <section className="mx-6 grid grid-cols-2 gap-3">
        <Stat icon={TrendingUp} label="Hoje" value={`R$ ${totalHoje.toFixed(2)}`} />
        <Stat icon={WalletIcon} label="Este mês" value={`R$ ${totalMes.toFixed(2)}`} />
      </section>

      <section className="mx-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Extrato</h2>
        {extratoQ.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />)
        ) : tx.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <WalletIcon className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 font-medium">Nenhuma movimentação</p>
            <p className="mt-1 text-sm text-muted-foreground">Seus recebimentos vão aparecer aqui.</p>
          </div>
        ) : (
          tx.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.tipo === "credito" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {t.tipo === "credito" ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.descricao ?? t.tipo}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString("pt-BR")} · {t.payments?.forma ?? ""}
                </p>
              </div>
              <p className={`font-bold ${t.tipo === "credito" ? "text-success" : "text-destructive"}`}>
                {t.tipo === "credito" ? "+" : "-"} R$ {Number(t.valor).toFixed(2)}
              </p>
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