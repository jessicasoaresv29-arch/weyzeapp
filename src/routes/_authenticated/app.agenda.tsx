import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Trash2, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyPrestador } from "@/lib/prestador";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  component: Agenda,
});

function Agenda() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ["me-prestador", user?.id],
    enabled: !!user,
    queryFn: () => getMyPrestador(user!.id),
  });
  const prestadorId = meQ.data?.id;

  const [data, setData] = useState("");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["agenda", prestadorId],
    enabled: !!prestadorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda" as any)
        .select("id, data, hora_inicio, hora_fim, tipo, observacao")
        .eq("prestador_id", prestadorId!)
        .gte("data", new Date().toISOString().slice(0, 10))
        .order("data", { ascending: true });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  async function adicionar() {
    if (!prestadorId || !data) return toast.error("Escolha uma data.");
    setBusy(true);
    const { error } = await supabase.from("agenda" as any).insert({
      prestador_id: prestadorId,
      data,
      hora_inicio: ini || null,
      hora_fim: fim || null,
      tipo: "bloqueio",
      observacao: obs || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bloqueio adicionado.");
    setData(""); setIni(""); setFim(""); setObs("");
    qc.invalidateQueries({ queryKey: ["agenda"] });
  }

  async function remover(id: string) {
    const { error } = await supabase.from("agenda" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["agenda"] });
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <Link to="/app/painel" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Minha agenda</h1>
      </header>

      <section className="mx-6 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="text-sm text-muted-foreground">Bloqueie datas indisponíveis para não receber pedidos nesse período.</p>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Início</Label>
            <Input type="time" value={ini} onChange={(e) => setIni(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Fim</Label>
            <Input type="time" value={fim} onChange={(e) => setFim(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Observação</Label>
          <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: viagem, folga" className="h-11 rounded-xl" />
        </div>
        <Button onClick={adicionar} disabled={busy} className="h-11 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><CalendarPlus className="h-4 w-4" /> Bloquear data</>)}
        </Button>
      </section>

      <section className="mx-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Próximos bloqueios</h2>
        {q.isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />)
        ) : (q.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 font-medium">Nenhum bloqueio</p>
            <p className="mt-1 text-sm text-muted-foreground">Sua agenda está toda disponível.</p>
          </div>
        ) : (
          q.data!.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
              <div>
                <p className="font-semibold">{new Date(a.data + "T00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</p>
                <p className="text-xs text-muted-foreground">
                  {a.hora_inicio ? `${a.hora_inicio.slice(0,5)}${a.hora_fim ? ` – ${a.hora_fim.slice(0,5)}` : ""}` : "Dia inteiro"}
                  {a.observacao ? ` · ${a.observacao}` : ""}
                </p>
              </div>
              <button onClick={() => remover(a.id)} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}