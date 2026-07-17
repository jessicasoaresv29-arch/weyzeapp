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

/**
 * Cria uma Preferência de pagamento no Mercado Pago (Checkout Pro / Wallet Brick).
 * Retorna preference_id + init_point. Não expõe access token no frontend.
 * Recebe: valor, descrição, email do comprador e id do serviço (contrato).
 */
export const criarPreferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        contratoId: z.string().uuid(),
        valor: z.number().positive().max(1_000_000),
        descricao: z.string().trim().min(1).max(200),
        emailComprador: z.string().email(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Confirma que o contrato pertence ao cliente logado
    const { data: contrato, error } = await supabase
      .from("contratos")
      .select("id, cliente_id, valor_final, status")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (error) throw error;
    if (!contrato || contrato.cliente_id !== userId) {
      throw new Error("Contrato não encontrado.");
    }

    const pref = await mpFetch<{
      id: string;
      init_point: string;
      sandbox_init_point: string;
    }>("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            id: data.contratoId,
            title: data.descricao,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(data.valor),
          },
        ],
        payer: { email: data.emailComprador },
        external_reference: data.contratoId,
        notification_url:
          "https://weyzeapp.lovable.app/api/public/webhooks/mercadopago",
        back_urls: {
          success: "https://weyzeapp.lovable.app/app/carteira",
          failure: "https://weyzeapp.lovable.app/app/carteira",
          pending: "https://weyzeapp.lovable.app/app/carteira",
        },
        auto_return: "approved",
      }),
    });

    return {
      preferenceId: pref.id,
      initPoint: pref.init_point,
      sandboxInitPoint: pref.sandbox_init_point,
    };
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

// =============================================================
// TEST HELPERS — usados apenas pela tela /app/mp-teste
// =============================================================

/** Cria uma Preferência de teste no MP (Wallet Brick / Checkout Pro). */
export const criarPreferenciaTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        valor: z.number().positive().max(100000),
        descricao: z.string().trim().min(1).max(200).default("Teste Weyze"),
        emailComprador: z.string().email(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const externalRef = `test-${crypto.randomUUID()}`;

    const pref = await mpFetch<{ id: string; init_point: string; sandbox_init_point: string }>(
      "/checkout/preferences",
      {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              id: externalRef,
              title: data.descricao,
              quantity: 1,
              currency_id: "BRL",
              unit_price: Number(data.valor),
            },
          ],
          payer: { email: data.emailComprador },
          external_reference: externalRef,
          notification_url: "https://weyzeapp.lovable.app/api/public/webhooks/mercadopago",
          back_urls: {
            success: "https://weyzeapp.lovable.app/app/mp-teste",
            failure: "https://weyzeapp.lovable.app/app/mp-teste",
            pending: "https://weyzeapp.lovable.app/app/mp-teste",
          },
          auto_return: "approved",
        }),
      },
    );

    await (supabaseAdmin as any).from("mp_test_payments").insert({
      user_id: userId,
      external_ref: externalRef,
      valor: data.valor,
      forma: "cartao",
      status: "pendente",
      preference_id: pref.id,
      init_point: pref.init_point,
    });

    return {
      externalRef,
      preferenceId: pref.id,
      initPoint: pref.init_point,
      sandboxInitPoint: pref.sandbox_init_point,
    };
  });

/** Cria pagamento PIX de teste (retorna QR + copia-e-cola). */
export const criarPixTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        valor: z.number().positive().max(100000),
        descricao: z.string().trim().min(1).max(200).default("Teste Weyze PIX"),
        emailComprador: z.string().email(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const externalRef = `test-${crypto.randomUUID()}`;

    const mp = await mpFetch<MPPayment>("/v1/payments", {
      method: "POST",
      body: JSON.stringify({
        transaction_amount: Number(data.valor),
        description: data.descricao,
        payment_method_id: "pix",
        external_reference: externalRef,
        notification_url: "https://weyzeapp.lovable.app/api/public/webhooks/mercadopago",
        payer: {
          email: data.emailComprador,
          first_name: "Teste",
          last_name: "Weyze",
        },
      }),
    });

    const qr = mp.point_of_interaction?.transaction_data;

    await (supabaseAdmin as any).from("mp_test_payments").insert({
      user_id: userId,
      external_ref: externalRef,
      valor: data.valor,
      forma: "pix",
      status: mp.status ?? "pendente",
      status_detail: mp.status_detail,
      mp_payment_id: String(mp.id),
      pix_qr_base64: qr?.qr_code_base64 ?? null,
      pix_copia_cola: qr?.qr_code ?? null,
      metadata: mp as any,
    });

    return {
      externalRef,
      mpPaymentId: String(mp.id),
      status: mp.status,
      qrCodeBase64: qr?.qr_code_base64 ?? null,
      copiaCola: qr?.qr_code ?? null,
      ticketUrl: qr?.ticket_url ?? null,
    };
  });

/** Consulta o MP e sincroniza o pagamento de teste. */
export const sincronizarTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ externalRef: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await (supabaseAdmin as any)
      .from("mp_test_payments")
      .select("*")
      .eq("external_ref", data.externalRef)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Pagamento de teste não encontrado.");

    // Busca no MP por external_reference
    const search = await mpFetch<{ results: any[] }>(
      `/v1/payments/search?external_reference=${encodeURIComponent(data.externalRef)}&sort=date_created&criteria=desc&limit=1`,
    );
    const mp = search.results?.[0];
    if (!mp) return { status: row.status, statusDetail: row.status_detail };

    await (supabaseAdmin as any)
      .from("mp_test_payments")
      .update({
        status: mp.status,
        status_detail: mp.status_detail,
        mp_payment_id: String(mp.id),
        metadata: mp,
        updated_at: new Date().toISOString(),
      })
      .eq("external_ref", data.externalRef);

    return { status: mp.status, statusDetail: mp.status_detail, mpPaymentId: String(mp.id) };
  });