import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { createAsaasPixCharge, syncAsaasPixCharge } from "@/lib/asaas.functions";

export type PixCharge = Awaited<ReturnType<typeof createAsaasPixCharge>>;

/** Cobrança PIX (Asaas) de um contrato concluído. */
export function useAsaasPix(contratoId: string | undefined) {
  const criar = useServerFn(createAsaasPixCharge);
  const sincronizar = useServerFn(syncAsaasPixCharge);

  const [cobranca, setCobranca] = useState<PixCharge | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);

  const gerar = useCallback(async () => {
    if (!contratoId) return null;
    setLoading(true);
    setErro(null);
    try {
      const r = await criar({ data: { contratoId } });
      setCobranca(r);
      idRef.current = r.id;
      return r;
    } catch (e: any) {
      setErro(e?.message ?? "Não foi possível gerar o PIX.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [contratoId, criar]);

  // Polling de confirmação: o status só muda pela reconsulta oficial no backend.
  useEffect(() => {
    if (!cobranca || cobranca.status === "aprovado") return;
    const timer = setInterval(async () => {
      const id = idRef.current;
      if (!id) return;
      try {
        const r = await sincronizar({ data: { pagamentoId: id } });
        setCobranca(r);
      } catch {
        /* silencioso */
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [cobranca, sincronizar]);

  return { cobranca, loading, erro, setErro, gerar, pago: cobranca?.status === "aprovado" };
}
