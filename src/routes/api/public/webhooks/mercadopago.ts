import { createFileRoute } from "@tanstack/react-router";

const MP_BASE = "https://api.mercadopago.com";

export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!token) return new Response("Not configured", { status: 500 });

        let payload: any = {};
        try {
          payload = await request.json();
        } catch {
          const url = new URL(request.url);
          payload = Object.fromEntries(url.searchParams.entries());
        }

        // MP sends: { type: 'payment', data: { id: '...' } } OR ?topic=payment&id=...
        const paymentId =
          payload?.data?.id ??
          payload?.["data.id"] ??
          payload?.id ??
          new URL(request.url).searchParams.get("id");
        const topic = payload?.type ?? payload?.topic ?? new URL(request.url).searchParams.get("topic");

        if (!paymentId || (topic && topic !== "payment")) {
          return new Response("ignored", { status: 200 });
        }

        const res = await fetch(`${MP_BASE}/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return new Response("mp fetch failed", { status: 200 });
        const mp = await res.json();

        const internalId = mp?.external_reference;
        if (!internalId) return new Response("no external_reference", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (mp.status === "approved") {
          await supabaseAdmin.rpc("confirmar_pagamento_gateway" as any, {
            _payment_id: internalId,
            _mp_payment_id: String(mp.id),
            _status_detail: mp.status_detail,
            _metadata: mp,
          } as any);
        } else if (["rejected", "cancelled"].includes(mp.status)) {
          await (supabaseAdmin as any)
            .from("payments")
            .update({
              status: mp.status === "rejected" ? "recusado" : "cancelado",
              status_detail: mp.status_detail,
              gateway_metadata: mp,
            })
            .eq("id", internalId);
        } else {
          await (supabaseAdmin as any)
            .from("payments")
            .update({ status_detail: mp.status_detail, gateway_metadata: mp })
            .eq("id", internalId);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});