import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { cancelPayment, confirmPayment, createPayment, getPublicKey, processCard } from "@/lib/pagamentos.functions";
import type { MetodoPagamento, PagamentoResumo } from "@/lib/pagamentos.types";

/** Estado e ações de pagamento de um contrato (PIX e cartão). */
export function usePagamento(contratoId: string | undefined) {
  const criar = useServerFn(createPayment);
  const cartao = useServerFn(processCard);
  const sincronizar = useServerFn(confirmPayment);
  const cancelar = useServerFn(cancelPayment);
  const chavePublica = useServerFn(getPublicKey);

  const [pagamento, setPagamento] = useState<PagamentoResumo | null>(null);
  const [publicKey, setPublicKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    chavePublica({}).then((r) => setPublicKey(r.publicKey)).catch(() => setPublicKey(""));
  }, [chavePublica]);

  const iniciar = useCallback(
    async (metodo: MetodoPagamento) => {
      if (!contratoId) return null;
      setLoading(true);
      setErro(null);
      try {
        const r = await criar({ data: { contratoId, metodo } });
        setPagamento(r);
        return r;
      } catch (e: any) {
        setErro(e?.message ?? "Não foi possível iniciar o pagamento.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [contratoId, criar],
  );

  const pagarComCartao = useCallback(
    async (formData: any) => {
      if (!pagamento) return null;
      setLoading(true);
      setErro(null);
      try {
        const r = await cartao({
          data: {
            pagamentoId: pagamento.id,
            token: formData.token,
            paymentMethodId: formData.payment_method_id,
            issuerId: formData.issuer_id ? String(formData.issuer_id) : undefined,
            installments: Number(formData.installments ?? 1),
            email: formData.payer?.email,
            identificationType: formData.payer?.identification?.type,
            identificationNumber: formData.payer?.identification?.number,
          },
        });
        setPagamento(r);
        if (r.status === "recusado") setErro("Pagamento recusado. Tente outro cartão.");
        return r;
      } catch (e: any) {
        setErro(e?.message ?? "Falha ao processar o cartão.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [cartao, pagamento],
  );

  const atualizarStatus = useCallback(async () => {
    if (!pagamento) return;
    try {
      const r = await sincronizar({ data: { pagamentoId: pagamento.id } });
      setPagamento(r);
    } catch {
      /* silencioso: polling */
    }
  }, [pagamento, sincronizar]);

  const cancelarPagamento = useCallback(async () => {
    if (!pagamento) return;
    await cancelar({ data: { pagamentoId: pagamento.id } }).catch(() => null);
    setPagamento(null);
  }, [cancelar, pagamento]);

  // PIX: acompanha a confirmação em tempo real + polling de segurança
  useEffect(() => {
    if (!pagamento || pagamento.status !== "pendente") return;
    const channel = supabase
      .channel(`pagamento-${pagamento.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pagamentos", filter: `id=eq.${pagamento.id}` },
        (p: any) => setPagamento((prev) => (prev ? { ...prev, ...p.new, valor: Number(p.new.valor) } : prev)),
      )
      .subscribe();
    const timer = setInterval(atualizarStatus, 8000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [pagamento, atualizarStatus]);

  return { pagamento, setPagamento, publicKey, loading, erro, setErro, iniciar, pagarComCartao, atualizarStatus, cancelarPagamento };
}