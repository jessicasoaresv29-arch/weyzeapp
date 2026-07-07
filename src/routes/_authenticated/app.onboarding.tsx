import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Check, ChevronRight, MapPin, ListChecks, FileText, Power } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchCategorias } from "@/lib/data";
import { ensurePrestador, getMyPrestador } from "@/lib/prestador";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/app/onboarding")({
  component: Onboarding,
});

const STEPS = [
  { id: 1, title: "Documentos", icon: FileText },
  { id: 2, title: "Categorias", icon: ListChecks },
  { id: 3, title: "Cidade", icon: MapPin },
  { id: 4, title: "Disponibilidade", icon: Power },
];

function Onboarding() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [prestadorId, setPrestadorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [tipoDoc, setTipoDoc] = useState<"rg" | "cnh" | "cpf">("rg");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selCats, setSelCats] = useState<Set<string>>(new Set());
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [raio, setRaio] = useState(20);
  const [disponivel, setDisponivel] = useState(true);
  const [descProf, setDescProf] = useState("");

  const cats = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const p = await ensurePrestador(user.id);
      setPrestadorId(p.id);
      setDisponivel(p.disponivel);
      setSelCats(new Set((p.prestador_categorias ?? []).map((c: any) => c.categoria_id)));
      setDescProf(p.descricao_profissional ?? "");
      setRaio(p.raio_atendimento_km ?? 20);
    })();
  }, [user]);

  useEffect(() => {
    if (profile) {
      setCidade(profile.cidade ?? "");
      setEstado(profile.estado ?? "");
    }
  }, [profile]);

  async function uploadDoc() {
    if (!user || !prestadorId || !docFile) return toast.error("Selecione um arquivo.");
    setBusy(true);
    const path = `${user.id}/${Date.now()}-${docFile.name}`;
    const up = await supabase.storage.from("documentos").upload(path, docFile);
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { error } = await supabase.from("documentos").insert({
      prestador_id: prestadorId, tipo_documento: tipoDoc, arquivo_url: path,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Documento enviado para análise!");
    setDocFile(null);
    setStep(2);
  }

  async function salvarCategorias() {
    if (!prestadorId) return;
    if (selCats.size === 0) return toast.error("Escolha pelo menos 1 categoria.");
    setBusy(true);
    await supabase.from("prestador_categorias").delete().eq("prestador_id", prestadorId);
    const rows = Array.from(selCats).map((cid) => ({ prestador_id: prestadorId, categoria_id: cid }));
    const { error } = await supabase.from("prestador_categorias").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Categorias salvas.");
    setStep(3);
  }

  async function salvarCidade() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ cidade, estado }).eq("id", user.id);
    if (!error && prestadorId) {
      await supabase.from("prestadores").update({ raio_atendimento_km: raio, descricao_profissional: descProf }).eq("id", prestadorId);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    setStep(4);
  }

  async function salvarDisponibilidade() {
    if (!prestadorId) return;
    setBusy(true);
    const { error } = await supabase.from("prestadores").update({ disponivel }).eq("id", prestadorId);
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
    toast.success("Tudo pronto! Bem-vindo ao Weyze.");
    navigate({ to: "/app/painel" });
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <header className="px-6 pt-8">
        <h1 className="text-2xl font-bold">Ativar minha conta de prestador</h1>
        <p className="text-sm text-muted-foreground">Complete 4 passos para começar a receber pedidos.</p>
      </header>

      <div className="flex gap-2 px-6">
        {STEPS.map((s) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div key={s.id} className="flex-1">
              <div className={`h-1.5 rounded-full ${done || active ? "bg-primary" : "bg-secondary"}`} />
              <p className={`mt-2 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{s.title}</p>
            </div>
          );
        })}
      </div>

      <section className="mx-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold">Envie um documento</h2>
            <p className="text-sm text-muted-foreground">Precisamos verificar sua identidade. Nossa equipe analisará em até 24h.</p>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["rg", "cnh", "cpf"] as const).map((t) => (
                  <button key={t} onClick={() => setTipoDoc(t)}
                    className={`rounded-xl border p-3 text-sm font-semibold uppercase ${tipoDoc === t ? "border-primary bg-secondary text-primary" : "border-border"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc">Arquivo (foto ou PDF)</Label>
              <label htmlFor="doc" className="flex h-32 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary">
                <Upload className="h-5 w-5" />
                {docFile ? docFile.name : "Toque para escolher"}
              </label>
              <input id="doc" type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button onClick={uploadDoc} disabled={busy} className="h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Enviar e continuar <ChevronRight className="h-4 w-4" /></>)}
            </Button>
            <button onClick={() => setStep(2)} className="w-full text-center text-xs text-muted-foreground underline">Pular por agora</button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold">Quais serviços você presta?</h2>
            <p className="text-sm text-muted-foreground">Escolha uma ou mais.</p>
            <div className="flex flex-wrap gap-2">
              {(cats.data ?? []).map((c) => {
                const active = selCats.has(c.id);
                return (
                  <button key={c.id} onClick={() => {
                    setSelCats((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
                  }}
                    className={`rounded-full border px-3 py-1.5 text-sm ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                    {active && <Check className="mr-1 inline h-3 w-3" />}{c.nome}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2 pt-2">
              <Label>Fale sobre sua experiência</Label>
              <Textarea rows={3} value={descProf} onChange={(e) => setDescProf(e.target.value)} placeholder="Ex.: 8 anos como eletricista predial..." />
            </div>
            <Button onClick={salvarCategorias} disabled={busy} className="h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar"}
            </Button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold">Onde você atende?</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Cidade</Label>
                <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} className="h-12 rounded-xl uppercase" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Raio de atendimento: <span className="font-semibold">{raio} km</span></Label>
              <input type="range" min={1} max={100} value={raio} onChange={(e) => setRaio(Number(e.target.value))} className="w-full accent-primary" />
            </div>
            <Button onClick={salvarCidade} disabled={busy} className="h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar"}
            </Button>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-lg font-semibold">Fique disponível?</h2>
            <p className="text-sm text-muted-foreground">Ative para começar a receber solicitações. Você pode pausar quando quiser.</p>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary p-4">
              <div>
                <p className="font-semibold">Aceitar novos pedidos</p>
                <p className="text-xs text-muted-foreground">{disponivel ? "Você aparecerá nas buscas" : "Perfil pausado"}</p>
              </div>
              <Switch checked={disponivel} onCheckedChange={setDisponivel} />
            </div>
            <Button onClick={salvarDisponibilidade} disabled={busy} className="h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Concluir cadastro"}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}