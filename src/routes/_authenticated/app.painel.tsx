import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Clock, ChevronRight, Inbox, Send, CheckCircle2, Wallet, Images, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyPrestador, fetchSolicitacoesAbertas, fetchMinhasPropostas } from "@/lib/prestador";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/painel")({
  component: Painel,
});

function Painel() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"recebidas" | "propostas">("recebidas");

  const meQ = useQuery({
    queryKey: ["me-prestador", user?.id], enabled: !!user,
    queryFn: () => getMyPrestador(user!.id),
  });

  useEffect(() => {
    if (meQ.isSuccess && !meQ.data && profile?.tipo_usuario === "prestador") {
      navigate({ to: "/app/onboarding" });
    }
  }, [meQ.isSuccess, meQ.data, profile, navigate]);

  const prestador = meQ.data;
  const catIds = ((prestador as any)?.prestador_categorias ?? []).map((c: any) => c.categoria_id) as string[];

  const abertasQ = useQuery({
    queryKey: ["prestador-abertas", prestador?.id, catIds.join(",")],
    enabled: !!prestador,
    queryFn: () => fetchSolicitacoesAbertas(prestador!.id, catIds),
  });
  const propostasQ = useQuery({
    queryKey: ["prestador-propostas", prestador?.id],
    enabled: !!prestador,
    queryFn: () => fetchMinhasPropostas(prestador!.id),
  });

  async function togglaDisponivel(v: boolean) {
    if (!prestador) return;
    await supabase.from("prestadores").update({ disponivel: v }).eq("id", prestador.id);
    qc.invalidateQueries({ queryKey: ["me-prestador"] });
  }

  if (meQ.isLoading || !prestador) return <div className="p-6"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="bg-brand-gradient px-6 pb-8 pt-8 text-white">
        <p className="text-sm text-white/80">Painel do prestador</p>
        <h1 className="mt-1 text-2xl font-bold">Olá, {profile?.nome?.split(" ")[0]} 👋</h1>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/15 p-4 backdrop-blur">
          <div>
            <p className="font-semibold">{prestador.disponivel ? "Disponível" : "Pausado"}</p>
            <p className="text-xs text-white/80">{prestador.disponivel ? "Recebendo pedidos" : "Ative para receber pedidos"}</p>
          </div>
          <Switch checked={prestador.disponivel} onCheckedChange={togglaDisponivel} />
        </div>
      </header>

      <div className="mx-6 -mt-4 grid grid-cols-2 gap-3">
        <Stat icon={Inbox} label="Solicitações" value={abertasQ.data?.length ?? 0} />
        <Stat icon={Send} label="Propostas" value={propostasQ.data?.length ?? 0} />
      </div>

      <nav className="mx-6 grid grid-cols-3 gap-3">
        <QuickLink to="/app/financeiro" icon={Wallet} label="Financeiro" />
        <QuickLink to="/app/portfolio" icon={Images} label="Portfólio" />
        <QuickLink to="/app/agenda" icon={CalendarDays} label="Agenda" />
      </nav>

      <div className="mx-6 flex gap-2 rounded-full bg-secondary p-1">
        {(["recebidas", "propostas"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {t === "recebidas" ? "Novas solicitações" : "Minhas propostas"}
          </button>
        ))}
      </div>

      {tab === "recebidas" ? (
        <section className="space-y-3 px-6">
          {abertasQ.isLoading ? <Skel /> : (abertasQ.data ?? []).length === 0 ? (
            <Empty title="Nenhuma solicitação aberta" hint="Configure suas categorias para receber pedidos compatíveis." />
          ) : abertasQ.data!.map((s: any) => (
            <SolicitacaoCard key={s.id} s={s} prestadorId={prestador.id} onDone={() => { abertasQ.refetch(); propostasQ.refetch(); }} />
          ))}
        </section>
      ) : (
        <section className="space-y-3 px-6">
          {propostasQ.isLoading ? <Skel /> : (propostasQ.data ?? []).length === 0 ? (
            <Empty title="Nenhuma proposta enviada ainda" hint="Envie propostas para começar a fechar contratos." />
          ) : propostasQ.data!.map((p: any) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.solicitacoes?.titulo ?? "Serviço"}</p>
                  <p className="text-xs text-muted-foreground">R$ {Number(p.valor).toFixed(2)} · {new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.mensagem && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.mensagem}</p>}
              {p.status === "aceita" && (
                <Link to="/app/chat" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Abrir chat <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to as never} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-3 shadow-card transition-colors hover:border-primary">
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  );
}

function Skel() { return <>{[1,2,3].map((i)=><div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />)}</>; }
function Empty({ title, hint }: any) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center"><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{hint}</p></div>;
}
function StatusBadge({ status }: { status: string }) {
  const map: any = {
    enviada: { text: "Aguardando", cls: "bg-primary/10 text-primary" },
    aceita: { text: "Aceita", cls: "bg-success/10 text-success" },
    recusada: { text: "Recusada", cls: "bg-destructive/10 text-destructive" },
    cancelada: { text: "Cancelada", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? map.enviada;
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${m.cls}`}>{m.text}</span>;
}

function SolicitacaoCard({ s, prestadorId, onDone }: { s: any; prestadorId: string; onDone: () => void }) {
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function enviar() {
    if (!valor) return toast.error("Informe o valor.");
    setBusy(true);
    const { error } = await supabase.from("propostas").insert({
      solicitacao_id: s.id, prestador_id: prestadorId,
      valor: Number(valor), prazo_dias: prazo ? Number(prazo) : null, mensagem,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Proposta enviada!");
    setOpen(false); onDone();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {s.profiles?.nome?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{s.titulo}</p>
          <p className="text-xs text-muted-foreground">{s.categorias?.nome ?? "Serviço"}</p>
        </div>
        {s.valor_estimado && <span className="text-sm font-semibold text-success">R$ {Number(s.valor_estimado).toFixed(0)}</span>}
      </div>
      {s.descricao && <p className="mt-2 line-clamp-2 text-sm">{s.descricao}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {s.cidade && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.cidade}</span>}
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex-1 rounded-xl bg-success text-success-foreground hover:bg-success/90">Enviar proposta</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>Proposta para "{s.titulo}"</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={valor} onChange={(e)=>setValor(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-1"><Label>Prazo (dias)</Label><Input type="number" value={prazo} onChange={(e)=>setPrazo(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-1"><Label>Mensagem</Label><Textarea rows={3} value={mensagem} onChange={(e)=>setMensagem(e.target.value)} placeholder="Como você fará o serviço..." /></div>
              <Button onClick={enviar} disabled={busy} className="h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><CheckCircle2 className="h-4 w-4" /> Enviar</>)}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}