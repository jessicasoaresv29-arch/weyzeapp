import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, QrCode, CreditCard, Wallet, Banknote, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import {
  calcularTaxa,
  confirmarDinheiroCliente,
  gateway,
  getContrato,
  getPagamentoAtivo,
  iniciarPagamento,
  type FormaPagamento,
} from "@/lib/payments";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/pagamento/$contratoId")({
  component: Pagamento,
});

function Pagamento() {
  const { contratoId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const contratoQ = useQuery({ queryKey: ["contrato", contratoId], queryFn: () => getContrato(contratoId) });
  const pagQ = useQuery({ queryKey: ["pagamento-ativo", contratoId], queryFn: () => getPagamentoAtivo(contratoId) });

  const contrato: any = contratoQ.data;
  const pagamento: any = pagQ.data;
  const [forma, setForma] = useState<FormaPagamento | null>(null);
  const [parcelas, setParcelas] = useState(1);
  const [loading, setLoading] = useState(false);

  // Realtime: refresh quando pagamento muda
  useEffect(() => {
    if (!contratoId) return;
    const ch = supabase.channel(`pag-${contratoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `contrato_id=eq.${contratoId}` },
        () => qc.invalidateQueries({ queryKey: ["pagamento-ativo", contratoId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_confirmations" },
        () => qc.invalidateQueries({ queryKey: ["pagamento-ativo", contratoId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [contratoId, qc]);

  if (contratoQ.isLoading) return <Loading />;
  if (!contrato) return <Empty />;

  const valor = Number(contrato.valor_final ?? 0);
  const { taxa, liquido } = calcularTaxa(valor);
  const isCliente = contrato.cliente_id === user?.id;

  async function iniciar(f: FormaPagamento) {
    if (!isCliente) return toast.error("Apenas o cliente pode iniciar o pagamento.");
    setLoading(true);
    try {
      await iniciarPagamento(contratoId, f, parcelas);
      setForma(f);
      await qc.invalidateQueries({ queryKey: ["pagamento-ativo", contratoId] });
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível iniciar o pagamento.");
    } finally { setLoading(false); }
  }

  async function confirmarPix() {
    if (!pagamento) return;
    setLoading(true);
    try {
      await gateway.confirmarPagamento(pagamento.id);
      toast.success("Pagamento confirmado!");
      await qc.invalidateQueries({ queryKey: ["pagamento-ativo", contratoId] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao confirmar pagamento.");
    } finally { setLoading(false); }
  }

  async function confirmarDinheiro() {
    if (!pagamento) return;
    setLoading(true);
    try {
      await confirmarDinheiroCliente(pagamento.id);
      toast.success("Você confirmou o pagamento em dinheiro.");
      await qc.invalidateQueries({ queryKey: ["pagamento-ativo", contratoId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao confirmar.");
    } finally { setLoading(false); }
  }

  // ---- Renderização por estado ----
  const status = pagamento?.status;
  const showEscolha = !pagamento || ["cancelado", "recusado"].includes(status);
  const activeForma: FormaPagamento | undefined = pagamento?.forma;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <Link to="/app/chat" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Pagamento</h1>
          <p className="text-xs text-muted-foreground">{contrato.solicitacoes?.titulo ?? "Serviço"}</p>
        </div>
      </header>

      <section className="mx-6 rounded-2xl bg-brand-gradient p-5 text-white shadow-soft">
        <p className="text-xs text-white/80">Valor do serviço</p>
        <p className="mt-1 text-3xl font-bold">R$ {valor.toFixed(2)}</p>
        <div className="mt-3 flex justify-between text-xs text-white/80">
          <span>Taxa Weyze (8%)</span><span>R$ {taxa.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs text-white/90 font-medium">
          <span>Prestador recebe</span><span>R$ {liquido.toFixed(2)}</span>
        </div>
      </section>

      {status === "concluido" && (
        <section className="mx-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-8 w-8" />
          </div>
          <p className="mt-3 text-lg font-bold text-emerald-800">Pagamento concluído</p>
          <p className="mt-1 text-sm text-emerald-700">Código: {pagamento.codigo_transacao}</p>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/app/solicitacoes">Voltar aos pedidos</Link>
          </Button>
        </section>
      )}

      {showEscolha && isCliente && status !== "concluido" && (
        <section className="mx-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Escolha a forma de pagamento</h2>
          <div className="grid grid-cols-2 gap-3">
            <MetodoBtn icon={QrCode} label="PIX" onClick={() => iniciar("pix")} disabled={loading} />
            <MetodoBtn icon={CreditCard} label="Crédito" onClick={() => iniciar("credito")} disabled={loading} />
            <MetodoBtn icon={Wallet} label="Débito" onClick={() => iniciar("debito")} disabled={loading} />
            <MetodoBtn icon={Banknote} label="Dinheiro" onClick={() => iniciar("dinheiro")} disabled={loading} />
          </div>
        </section>
      )}

      {activeForma === "pix" && status !== "concluido" && (
        <section className="mx-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-center">
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-2xl bg-secondary">
              <QrCode className="h-24 w-24 text-primary" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Escaneie o QR Code no seu banco</p>
          </div>
          <div>
            <p className="text-xs font-medium">PIX Copia e Cola</p>
            <div className="mt-1 flex items-center gap-2">
              <Input readOnly value={pagamento?.pix_copia_cola ?? ""} className="rounded-xl text-xs" />
              <Button size="icon" variant="outline" className="shrink-0 rounded-xl"
                onClick={() => { navigator.clipboard.writeText(pagamento?.pix_copia_cola ?? ""); toast.success("Copiado!"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {isCliente && (
            <Button className="w-full rounded-xl bg-success text-success-foreground hover:bg-success/90" onClick={confirmarPix} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Já paguei — confirmar"}
            </Button>
          )}
        </section>
      )}

      {(activeForma === "credito" || activeForma === "debito") && status !== "concluido" && (
        <section className="mx-6 space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-semibold">Dados do cartão</h3>
          <Input placeholder="Nome no cartão" className="rounded-xl" />
          <Input placeholder="Número" className="rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="MM/AA" className="rounded-xl" />
            <Input placeholder="CVV" className="rounded-xl" />
          </div>
          {activeForma === "credito" && (
            <div>
              <p className="text-xs font-medium">Parcelas</p>
              <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
              </select>
            </div>
          )}
          {isCliente && (
            <Button className="w-full rounded-xl bg-success text-success-foreground hover:bg-success/90" onClick={confirmarPix} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pagar agora"}
            </Button>
          )}
        </section>
      )}

      {activeForma === "dinheiro" && status !== "concluido" && (
        <section className="mx-6 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-900">Pagamento em dinheiro</h3>
          <p className="text-sm text-amber-800">Ambas as partes precisam confirmar o pagamento em dinheiro.</p>
          <div className="space-y-2 rounded-xl bg-white p-3">
            <ConfirmRow ok={pagamento?.cash_confirmations?.prestador_confirmou} label="Prestador confirmou" />
            <ConfirmRow ok={pagamento?.cash_confirmations?.cliente_confirmou} label="Cliente confirmou" />
          </div>
          {isCliente && !pagamento?.cash_confirmations?.cliente_confirmou && (
            <Button className="w-full rounded-xl bg-success text-success-foreground hover:bg-success/90" onClick={confirmarDinheiro} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmo que paguei em dinheiro"}
            </Button>
          )}
        </section>
      )}

      {!isCliente && status !== "concluido" && (
        <p className="mx-6 rounded-xl bg-secondary p-4 text-center text-sm text-muted-foreground">
          Aguardando o cliente concluir o pagamento.
        </p>
      )}
    </div>
  );
}

function MetodoBtn({ icon: Icon, label, onClick, disabled }: any) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-6 shadow-card transition hover:border-primary disabled:opacity-50">
      <Icon className="h-8 w-8 text-primary" />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
function ConfirmRow({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      {ok ? <Check className="h-4 w-4 text-success" /> : <span className="text-xs text-muted-foreground">Aguardando</span>}
    </div>
  );
}
function Loading() { return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>; }
function Empty() { return <div className="p-8 text-center text-muted-foreground">Contrato não encontrado.</div>; }