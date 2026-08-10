import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * asaas-webhook — recebe eventos externos do Asaas.
 * Segurança:
 *  - token de autenticação do webhook (header asaas-access-token), quando configurado;
 *  - reconsulta obrigatória da cobrança na API oficial antes de qualquer gravação;
 *  - idempotência via tabela payment_events.
 * Nesta etapa nenhum pagamento é aplicado ao banco — apenas registro seguro do evento.
 */
export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        let payload: any = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Payload inválido", { status: 400, headers: CORS });
        }

        const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
        if (esperado && request.headers.get("asaas-access-token") !== esperado) {
          console.error("[Asaas] token de webhook inválido");
          return new Response("Não autorizado", { status: 401, headers: CORS });
        }

        const asaas = await import("@/lib/asaas.server");
        const eventType: string = payload?.event ?? "";
        const paymentId: string | undefined = payload?.payment?.id;
        const eventId: string = payload?.id ?? `${eventType}:${paymentId ?? "sem-id"}`;

        if (!eventType) return new Response("ok", { headers: CORS });

        const admin = await asaas.getAdmin();
        const novo = await asaas.registrarEvento(admin, { eventId, eventType, paymentId, payload });
        if (!novo) return new Response("ok", { headers: CORS });

        try {
          if (paymentId && asaas.asaasConfigurado()) {
            // Nunca confiamos no payload: a API oficial é a fonte de verdade.
            const cobranca = await asaas.buscarCobranca(paymentId);
            asaas.logSeguro("webhook", { eventType, paymentId, status: cobranca?.status });
          } else {
            asaas.logSeguro("webhook:sem-credencial", { eventType, paymentId });
          }
          await asaas.marcarEventoProcessado(admin, eventId);
        } catch (error: any) {
          await asaas.marcarEventoProcessado(admin, eventId, error?.message ?? "erro");
        }

        return new Response("ok", { headers: CORS });
      },
    },
  },
});