import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCategorias } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({
  prestador: z.string().optional(),
  categoria: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/app/solicitar")({
  validateSearch: searchSchema,
  component: Solicitar,
});

function Solicitar() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cats = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });

  const [titulo, setTitulo] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | undefined>(search.categoria);
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [dataServico, setDataServico] = useState("");
  const [urgencia, setUrgencia] = useState<"baixa" | "media" | "alta">("media");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("solicitacoes").insert({
      cliente_id: user.id,
      categoria_id: categoriaId ?? null,
      prestador_alvo_id: search.prestador ?? null,
      titulo,
      descricao,
      endereco,
      cidade,
      data_servico: dataServico ? new Date(dataServico).toISOString() : null,
      urgencia,
      status: "aberto",
    }).select("id").maybeSingle();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada!");
    navigate({ to: "/app/solicitacoes" });
    void data;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <Link to="/app" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Solicitar serviço</h1>
      </header>

      <form onSubmit={submit} className="space-y-5 px-6 pb-8">
        <div className="space-y-2">
          <Label htmlFor="titulo">O que você precisa?</Label>
          <Input id="titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Instalar chuveiro elétrico" className="h-12 rounded-xl" />
        </div>

        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className="rounded-xl" placeholder="Detalhes do serviço, medidas, materiais..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endereco">Endereço</Label>
          <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="h-12 rounded-xl" placeholder="Rua, número, bairro" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} className="h-12 rounded-xl" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="data">Quando?</Label>
          <Input id="data" type="datetime-local" value={dataServico} onChange={(e) => setDataServico(e.target.value)} className="h-12 rounded-xl" />
        </div>

        <div className="space-y-2">
          <Label>Urgência</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["baixa", "media", "alta"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgencia(u)}
                className={`h-11 rounded-xl border text-sm font-medium capitalize transition-colors ${urgencia === u ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
              >{u}</button>
            ))}
          </div>
        </div>

        <Button type="submit" size="lg" disabled={loading} className="h-14 w-full rounded-2xl bg-success text-base font-semibold text-success-foreground shadow-soft hover:bg-success/90">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Solicitar agora"}
        </Button>
      </form>
    </div>
  );
}