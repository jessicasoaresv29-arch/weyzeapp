import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Upload, Trash2, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyPrestador } from "@/lib/prestador";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/portfolio")({
  component: Portfolio,
});

function Portfolio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ["me-prestador", user?.id],
    enabled: !!user,
    queryFn: () => getMyPrestador(user!.id),
  });
  const prestadorId = meQ.data?.id;
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [busy, setBusy] = useState(false);

  const itensQ = useQuery({
    queryKey: ["portfolio", prestadorId],
    enabled: !!prestadorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio")
        .select("id, imagem_url, titulo, descricao, created_at")
        .eq("prestador_id", prestadorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function upload() {
    if (!user || !prestadorId || !file) return toast.error("Selecione uma imagem.");
    setBusy(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("portfolio").upload(path, file);
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { data: pub } = supabase.storage.from("portfolio").getPublicUrl(path);
    const { error } = await supabase.from("portfolio").insert({
      prestador_id: prestadorId, imagem_url: pub.publicUrl, titulo: titulo || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Item adicionado ao portfólio!");
    setFile(null); setTitulo("");
    qc.invalidateQueries({ queryKey: ["portfolio"] });
  }

  async function remover(id: string) {
    const { error } = await supabase.from("portfolio").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["portfolio"] });
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <Link to="/app/painel" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Meu portfólio</h1>
      </header>

      <section className="mx-6 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="space-y-2">
          <Label>Título (opcional)</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Instalação de chuveiro" className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf">Imagem</Label>
          <label htmlFor="pf" className="flex h-28 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary">
            <Upload className="h-5 w-5" />
            {file ? file.name : "Selecionar imagem"}
          </label>
          <input id="pf" type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button onClick={upload} disabled={busy || !file} className="h-11 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><ImagePlus className="h-4 w-4" /> Adicionar</>)}
        </Button>
      </section>

      <section className="mx-6">
        {itensQ.isLoading ? (
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map((i)=><div key={i} className="aspect-square animate-pulse rounded-2xl bg-secondary" />)}</div>
        ) : (itensQ.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">Nenhum trabalho ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Envie fotos dos seus melhores serviços.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {itensQ.data!.map((it: any) => (
              <div key={it.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <img src={it.imagem_url} alt={it.titulo ?? "portfolio"} className="aspect-square w-full object-cover" loading="lazy" />
                {it.titulo && <p className="truncate p-2 text-xs font-medium">{it.titulo}</p>}
                <button onClick={() => remover(it.id)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}