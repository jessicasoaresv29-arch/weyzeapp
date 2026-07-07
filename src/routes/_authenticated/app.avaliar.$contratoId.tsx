import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/avaliar/$contratoId")({
  component: Avaliar,
});

function Avaliar() {
  const { contratoId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contrato, setContrato] = useState<any>(null);
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("contratos").select("id, prestador_id, cliente_id, prestadores(profiles(nome))").eq("id", contratoId).maybeSingle().then(({ data }) => setContrato(data));
  }, [contratoId]);

  async function enviar() {
    if (!user || !contrato) return;
    setBusy(true);
    const { error } = await supabase.from("avaliacoes").insert({
      cliente_id: user.id, prestador_id: contrato.prestador_id, contrato_id: contrato.id, nota, comentario,
    });
    if (!error) await supabase.from("contratos").update({ status: "concluido", data_final: new Date().toISOString() }).eq("id", contrato.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Obrigado pela avaliação!");
    navigate({ to: "/app/solicitacoes" });
  }

  const nome = contrato?.prestadores?.profiles?.nome ?? "prestador";

  return (
    <div className="flex flex-col gap-6 px-6 pt-8">
      <h1 className="text-2xl font-bold">Como foi seu serviço?</h1>
      <p className="text-muted-foreground">Avalie {nome} para ajudar outros clientes.</p>

      <div className="flex justify-center gap-2">
        {[1,2,3,4,5].map((n) => (
          <button key={n} onClick={() => setNota(n)} type="button">
            <Star className={`h-10 w-10 ${n <= nota ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} strokeWidth={n <= nota ? 0 : 2} />
          </button>
        ))}
      </div>

      <Textarea rows={4} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Conte como foi (opcional)…" />

      <Button onClick={enviar} disabled={busy} className="h-12 rounded-xl bg-success text-success-foreground hover:bg-success/90">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar avaliação"}
      </Button>
    </div>
  );
}