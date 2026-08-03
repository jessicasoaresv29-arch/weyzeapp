import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook do Mercado Pago.
 * Segurança em duas camadas:
 * 1. O payload recebido NUNCA é confiado: o pagamento é sempre reconsultado em
 *    /v1/payments/{id} com o Access Token, e o banco só é atualizado com a resposta oficial.
 * 2. Validação opcional de assinatura (x-signature). Só é aplicada se
 *    MERCADO_PAGO_WEBHOOK_SECRET estiver configurada — o Mercado Pago gera essa
 *    "chave secreta" ao cadastrar a URL de notificação no painel de integrações.
 */
function assinaturaValida(request: Request, dataId: string, secret: string): boolean {
  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!signature) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]),
  );
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(parts.v1);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let payload: any = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }

        const dataId = String(payload?.data?.id ?? "");
        const topico = payload?.type ?? payload?.topic ?? "";
        if (!dataId) return new Response("ok");

        const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
        if (secret && !assinaturaValida(request, dataId, secret)) {
          console.error("[MercadoPago] assinatura inválida", dataId);
          return new Response("Assinatura inválida", { status: 401 });
        }

        const mp = await import("@/lib/mercadopago.server");
        const admin = await mp.getAdmin();

        // Idempotência: o mesmo evento nunca é processado duas vezes.
        const eventoId = `${topico}:${dataId}:${payload?.action ?? ""}`;
        const { error: dup } = await admin
          .from("mp_webhook_eventos")
          .insert({ evento_id: eventoId, topico, payload });
        if (dup) return new Response("ok");

        try {
          if (topico === "payment" || topico === "payment.updated") {
            const mpPayment = await mp.buscarPagamentoMp(dataId);
            const { data: pagamento } = await admin
              .from("pagamentos")
              .select("*")
              .or(`external_reference.eq.${mpPayment.external_reference},mp_payment_id.eq.${dataId}`)
              .maybeSingle();
            if (pagamento) await mp.aplicarStatusMp(admin, pagamento, mpPayment);
          }
          await admin.from("mp_webhook_eventos").update({ processado: true }).eq("evento_id", eventoId);
        } catch (error: any) {
          console.error("[MercadoPago] webhook", error);
          await admin.from("mp_webhook_eventos").update({ erro: String(error?.message ?? error) }).eq("evento_id", eventoId);
          return new Response("Erro ao processar", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});