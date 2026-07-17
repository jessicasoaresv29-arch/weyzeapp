import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Loader2, QrCode, CreditCard, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  criarPixTeste,
  criarPreferenciaTeste,
  getMpPublicKey,
  sincronizarTeste,
} from "@/lib/mercadopago.functions";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";

export const Route = createFileRoute("/_authenticated/app/mp-teste")({
  component: MpTestePage,
});

type Forma = "pix" | "cartao";

type TestPayment = {
  id: string;
  external_ref: string;
  valor: number;
  forma: Forma;
  status: string;
  status_detail: string | null;
  mp_payment_id: string | null;
  preference_id: string | null;
  init_point: string | null;
  pix_qr_base64: string | null;
  pix_copia_cola: string | null;
};

type WebhookRow = {
  id: string;
  external_ref: string | null;
  mp_payment_id: string | null;
  status: string | null;
  status_detail: string | null;
  received_at: string;
};

function MpTestePage() {
  const { user } = useAuth();
  const [valor, setValor] = useState("10.00");
  const [forma, setForma] = useState<Forma>("pix");
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<TestPayment | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [mpReady, setMpReady] = useState(false);

  useEffect(() => {
    let alive = true;
    getMpPublicKey().then(({ publicKey }) => {
      if (!alive || !publicKey) return;
      try {
        initMercadoPago(publicKey, { locale: "pt-BR" });
        setMpReady(true);
      } catch (e) {
        console.error("[MP init]", e);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Realtime: acompanha status do pagamento atual
  useEffect(() => {
    if (!current?.external_ref) return;
    const ref = current.external_ref;
    const ch = supabase
      .channel(`mp-test-${ref}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mp_test_payments", filter: `external_ref=eq.${ref}` },
        (payload) => setCurrent((c) => (c ? { ...c, ...(payload.new as any) } : c)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [current?.external_ref]);

  // Poll webhooks recentes (últimos 20)
  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await (supabase as any)
        .from("mp_webhook_log")
        .select("id, external_ref, mp_payment_id, status, status_detail, received_at")
        .order("received_at", { ascending: false })
        .limit(20);
      if (alive) setWebhooks(data ?? []);
    }
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const valorNum = useMemo(() => Number(valor.replace(",", ".")), [valor]);

  async function gerar() {
    if (!user?.email) return toast.error("Faça login com um e-mail válido.");
    if (!Number.isFinite(valorNum) || valorNum <= 0) return toast.error("Informe um valor válido.");
    setLoading(true);
    setCurrent(null);
    try {
      if (forma === "pix") {
        const res = await criarPixTeste({
          data: { valor: valorNum, descricao: "Teste PIX Weyze", emailComprador: user.email },
        });
        setCurrent({
          id: res.externalRef,
          external_ref: res.externalRef,
          valor: valorNum,
          forma: "pix",
          status: res.status ?? "pendente",
          status_detail: null,
          mp_payment_id: res.mpPaymentId,
          preference_id: null,
          init_point: null,
          pix_qr_base64: res.qrCodeBase64,
          pix_copia_cola: res.copiaCola,
        });
        toast.success("QR Code PIX gerado.");
      } else {
        const res = await criarPreferenciaTeste({
          data: { valor: valorNum, descricao: "Teste Cartão Weyze", emailComprador: user.email },
        });
        setCurrent({
          id: res.externalRef,
          external_ref: res.externalRef,
          valor: valorNum,
          forma: "cartao",
          status: "pendente",
          status_detail: null,
          mp_payment_id: null,
          preference_id: res.preferenceId,
          init_point: res.initPoint,
          pix_qr_base64: null,
          pix_copia_cola: null,
        });
        toast.success("Preferência criada. Use o Checkout ao lado.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar pagamento.");
    } finally {
      setLoading(false);
    }
  }

  async function sincronizar() {
    if (!current) return;
    try {
      const res = await sincronizarTeste({ data: { externalRef: current.external_ref } });
      setCurrent({ ...current, status: res.status, status_detail: res.statusDetail ?? null });
      toast.success(`Status: ${res.status}`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao sincronizar.");
    }
  }

  const webhooksDoAtual = current
    ? webhooks.filter((w) => w.external_ref === current.external_ref)
    : [];

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <Link to="/app" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Teste Mercado Pago</h1>
          <p className="text-xs text-muted-foreground">Ambiente ligado ao token configurado</p>
        </div>
      </header>

      <section className="mx-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="space-y-2">
          <Label htmlFor="valor">Valor (R$)</Label>
          <Input
            id="valor"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Forma</Label>
          <div className="grid grid-cols-2 gap-3">
            <FormaBtn active={forma === "pix"} onClick={() => setForma("pix")} icon={QrCode} label="PIX" />
            <FormaBtn active={forma === "cartao"} onClick={() => setForma("cartao")} icon={CreditCard} label="Cartão" />
          </div>
        </div>
        <Button className="w-full rounded-xl" onClick={gerar} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar pagamento"}
        </Button>
      </section>

      {current && (
        <section className="mx-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pagamento atual</p>
              <p className="text-sm font-semibold">R$ {current.valor.toFixed(2)} · {current.forma.toUpperCase()}</p>
              <p className="mt-1 break-all text-[10px] text-muted-foreground">ref: {current.external_ref}</p>
              {current.mp_payment_id && (
                <p className="break-all text-[10px] text-muted-foreground">mp id: {current.mp_payment_id}</p>
              )}
            </div>
            <StatusBadge status={current.status} />
          </div>

          {current.forma === "pix" && current.pix_qr_base64 && (
            <div className="space-y-3 text-center">
              <img
                src={`data:image/png;base64,${current.pix_qr_base64}`}
                alt="QR Code PIX"
                className="mx-auto h-56 w-56 rounded-2xl border border-border bg-white p-2"
              />
              <div className="text-left">
                <p className="text-xs font-medium">PIX Copia e Cola</p>
                <div className="mt-1 flex items-center gap-2">
                  <Input readOnly value={current.pix_copia_cola ?? ""} className="rounded-xl text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    className="shrink-0 rounded-xl"
                    onClick={() => {
                      navigator.clipboard.writeText(current.pix_copia_cola ?? "");
                      toast.success("Copiado!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {current.forma === "cartao" && current.preference_id && (
            <div>
              {mpReady ? (
                <Wallet initialization={{ preferenceId: current.preference_id }} />
              ) : (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              )}
              {current.init_point && (
                <a
                  href={current.init_point}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block text-center text-xs text-primary underline"
                >
                  Abrir Checkout Pro em nova aba
                </a>
              )}
            </div>
          )}

          <Button variant="outline" className="w-full rounded-xl" onClick={sincronizar}>
            <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar status agora
          </Button>

          <div className="rounded-xl bg-secondary p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Webhooks recebidos para este pagamento
            </p>
            {webhooksDoAtual.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aguardando o Mercado Pago notificar…</p>
            ) : (
              <ul className="space-y-1">
                {webhooksDoAtual.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{w.status ?? "?"}</span>
                    <span className="text-muted-foreground">{new Date(w.received_at).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="mx-6 space-y-2 rounded-2xl border border-dashed border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Últimos 20 webhooks (global)
        </p>
        {webhooks.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum webhook registrado ainda.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {webhooks.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{w.external_ref ?? "—"}</span>
                <span className="font-medium">{w.status ?? "?"}</span>
                <span className="text-muted-foreground">{new Date(w.received_at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FormaBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition ${
        active ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <Icon className="h-6 w-6 text-primary" />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: any; text: string }> = {
    approved: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, text: "Aprovado" },
    concluido: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, text: "Aprovado" },
    pending: { color: "bg-amber-100 text-amber-700", icon: Clock, text: "Pendente" },
    pendente: { color: "bg-amber-100 text-amber-700", icon: Clock, text: "Pendente" },
    in_process: { color: "bg-amber-100 text-amber-700", icon: Clock, text: "Em análise" },
    rejected: { color: "bg-destructive/10 text-destructive", icon: XCircle, text: "Recusado" },
    cancelled: { color: "bg-muted text-muted-foreground", icon: XCircle, text: "Cancelado" },
  };
  const info = map[status] ?? { color: "bg-muted text-muted-foreground", icon: Clock, text: status };
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${info.color}`}>
      <Icon className="h-3.5 w-3.5" /> {info.text}
    </span>
  );
}