import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MP_BASE = "https://api.mercadopago.com";

type MPPayment = {
  id: number | string;
  status: string;
  status_detail: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

async function mpFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  const res = await fetch(`${MP_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    console.error("[MercadoPago]", res.status, body);
    throw new Error(body?.message || `Mercado Pago erro ${res.status}`);
  }
  return body as T;
}

/** Public key for the browser Bricks SDK (safe to expose). */
export const getMpPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY ?? "" };
});

/** Cliente cria pagamento PIX. Retorna QR code + copia-e-cola. */
export const criarPagamentoPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pg, error } = await supabase
      .from("payments")
      .select("id, cliente_id, valor_bruto, codigo_transacao, forma, status, contrato_id")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (error) throw error;
    if (!pg || pg.cliente_id !== userId) throw new Error("Pagamento não encontrado.");
    if (pg.forma !== "pix") throw new Error("Pagamento não é PIX.");

    const { data: profile } = await supabase.from("profiles").select("email, nome").eq("id", userId).maybeSingle();
    const [first_name, ...rest] = (profile?.nome ?? "Cliente Weyze").split(" ");

    const mp = await mpFetch<MPPayment>("/v1/payments", {
      method: "POST",
      body: JSON.stringify({
        transaction_amount: Number(pg.valor_bruto),
        description: `Weyze - ${pg.codigo_transacao}`,
        payment_method_id: "pix",
        external_reference: pg.id,
        notification_url: `https://weyzeapp.lovable.app/api/public/webhooks/mercadopago`,
        payer: {
          email: profile?.email ?? `cliente+${userId.slice(0, 8)}@weyze.app`,
          first_name: first_name || "Cliente",
          last_name: rest.join(" ") || "Weyze",
        },
      }),
    });

    const qr = mp.point_of_interaction?.transaction_data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("registrar_gateway_ids" as any, {
      _payment_id: pg.id,
      _mp_payment_id: String(mp.id),
      _mp_preference_id: null,
      _pix_qr_code: qr?.qr_code_base64 ?? null,
      _pix_copia_cola: qr?.qr_code ?? null,
      _metadata: mp as any,
    } as any);

    return {
      mpPaymentId: String(mp.id),
      qrCodeBase64: qr?.qr_code_base64 ?? null,
      copiaCola: qr?.qr_code ?? null,
      ticketUrl: qr?.ticket_url ?? null,
      status: mp.status,
    };
  });

/** Cliente processa pagamento por cartão a partir de um token gerado pelo Brick. */
export const processarPagamentoCartao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        paymentId: z.string().uuid(),
        token: z.string().min(1),
        payment_method_id: z.string().min(1),
        issuer_id: z.string().optional().nullable(),
        installments: z.number().int().min(1).max(12).default(1),
        payer: z.object({
          email: z.string().email(),
          identification: z
            .object({ type: z.string(), number: z.string() })
            .optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pg, error } = await supabase
      .from("payments")
      .select("id, cliente_id, valor_bruto, codigo_transacao, forma")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (error) throw error;
    if (!pg || pg.cliente_id !== userId) throw new Error("Pagamento não encontrado.");
    if (pg.forma !== "credito" && pg.forma !== "debito") throw new Error("Forma inválida para cartão.");

    const mp = await mpFetch<MPPayment & { payment_method_id?: string }>("/v1/payments", {
      method: "POST",
      body: JSON.stringify({
        transaction_amount: Number(pg.valor_bruto),
        token: data.token,
        description: `Weyze - ${pg.codigo_transacao}`,
        installments: data.installments,
        payment_method_id: data.payment_method_id,
        issuer_id: data.issuer_id ?? undefined,
        external_reference: pg.id,
        notification_url: `https://weyzeapp.lovable.app/api/public/webhooks/mercadopago`,
        payer: data.payer,
      }),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("registrar_gateway_ids" as any, {
      _payment_id: pg.id,
      _mp_payment_id: String(mp.id),
      _mp_preference_id: null,
      _pix_qr_code: null,
      _pix_copia_cola: null,
      _metadata: mp as any,
    } as any);

    if (mp.status === "approved") {
      await supabaseAdmin.rpc("confirmar_pagamento_gateway" as any, {
        _payment_id: pg.id,
        _mp_payment_id: String(mp.id),
        _status_detail: mp.status_detail,
        _metadata: mp as any,
      } as any);
    }

    return { status: mp.status, statusDetail: mp.status_detail, mpPaymentId: String(mp.id) };
  });

/** Consulta status atual no Mercado Pago para forçar reconciliação. */
export const reconciliarPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pg } = await supabase
      .from("payments")
      .select("id, cliente_id, mp_payment_id, status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!pg || pg.cliente_id !== userId) throw new Error("Pagamento não encontrado.");
    if (!pg.mp_payment_id) return { status: pg.status };

    const mp = await mpFetch<MPPayment>(`/v1/payments/${pg.mp_payment_id}`);
    if (mp.status === "approved" && pg.status !== "concluido") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("confirmar_pagamento_gateway" as any, {
        _payment_id: pg.id,
        _mp_payment_id: String(mp.id),
        _status_detail: mp.status_detail,
        _metadata: mp as any,
      } as any);
    }
    return { status: mp.status, statusDetail: mp.status_detail };
  });