import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public Key do Mercado Pago (única credencial que pode ir ao frontend). */
export const getPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { publicKey } = await import("./mercadopago.server");
  return { publicKey: publicKey() };
});

/** Cria (ou reutiliza) o pagamento do contrato. Nunca gera cobrança duplicada. */
export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      contratoId: z.string().uuid(),
      metodo: z.enum(["pix", "credit_card", "debit_card"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const mp = await import("./mercadopago.server");
    const admin = await mp.getAdmin();
    const { contrato, valor } = await mp.carregarContratoPagavel(admin, data.contratoId, context.userId);

    const ativo = await mp.pagamentoAtivo(admin, contrato.id);
    if (ativo && (ativo.status === "aprovado" || ativo.metodo === data.metodo)) {
      return mp.toResumo(ativo);
    }
    if (ativo) {
      await admin.from("pagamentos").update({ status: "cancelado" }).eq("id", ativo.id);
    }

    const registro = await mp.criarRegistroPagamento(admin, { contrato, valor, metodo: data.metodo });
    if (data.metodo !== "pix") return mp.toResumo(registro);

    // PIX: gera a cobrança imediatamente
    try {
      const { data: cliente } = await admin.from("profiles").select("nome, email").eq("id", context.userId).maybeSingle();
      const pago = await mp.mpRequest<any>("/v1/payments", {
        method: "POST",
        idempotencyKey: registro.external_reference,
        body: JSON.stringify({
          transaction_amount: valor,
          payment_method_id: "pix",
          description: "Serviço Weyze",
          external_reference: registro.external_reference,
          notification_url: `${process.env.APP_URL ?? ""}/api/public/mercadopago-webhook`,
          payer: { email: cliente?.email ?? "cliente@weyze.app", first_name: cliente?.nome ?? "Cliente" },
        }),
      });
      const tx = pago.point_of_interaction?.transaction_data ?? {};
      const { data: atualizado } = await admin
        .from("pagamentos")
        .update({
          mp_payment_id: String(pago.id),
          qr_code: tx.qr_code ?? null,
          qr_code_base64: tx.qr_code_base64 ?? null,
          ticket_url: tx.ticket_url ?? null,
          expires_at: pago.date_of_expiration ?? new Date(Date.now() + 30 * 60_000).toISOString(),
          payment_type: pago.payment_type_id ?? "bank_transfer",
          payment_method: "pix",
          raw: pago,
        })
        .eq("id", registro.id)
        .select("*")
        .single();
      return mp.toResumo(atualizado ?? registro);
    } catch (error: any) {
      await admin.from("pagamentos").update({ status: "cancelado", detalhe_erro: error?.message ?? "erro" }).eq("id", registro.id);
      throw error;
    }
  });

/** Processa cartão de crédito/débito com o token gerado pelo Checkout Brick. */
export const processCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      pagamentoId: z.string().uuid(),
      token: z.string().min(1),
      paymentMethodId: z.string().min(1),
      issuerId: z.string().optional(),
      installments: z.number().int().min(1).max(12).default(1),
      email: z.string().email(),
      identificationType: z.string().optional(),
      identificationNumber: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const mp = await import("./mercadopago.server");
    const admin = await mp.getAdmin();

    const { data: pagamento } = await admin.from("pagamentos").select("*").eq("id", data.pagamentoId).maybeSingle();
    if (!pagamento) throw new Error("Pagamento não encontrado.");
    if (pagamento.cliente_id !== context.userId) throw new Error("Sem permissão para este pagamento.");
    if (pagamento.status === "aprovado") return mp.toResumo(pagamento);
    await mp.carregarContratoPagavel(admin, pagamento.contrato_id, context.userId);

    const cobranca = await mp.mpRequest<any>("/v1/payments", {
      method: "POST",
      idempotencyKey: `${pagamento.external_reference}-${data.token.slice(0, 12)}`,
      body: JSON.stringify({
        transaction_amount: Number(pagamento.valor),
        token: data.token,
        description: "Serviço Weyze",
        installments: data.installments,
        payment_method_id: data.paymentMethodId,
        issuer_id: data.issuerId,
        external_reference: pagamento.external_reference,
        notification_url: `${process.env.APP_URL ?? ""}/api/public/mercadopago-webhook`,
        payer: {
          email: data.email,
          identification: data.identificationNumber
            ? { type: data.identificationType ?? "CPF", number: data.identificationNumber }
            : undefined,
        },
      }),
    });

    const atualizado = await mp.aplicarStatusMp(admin, pagamento, cobranca);
    return mp.toResumo(atualizado);
  });

/** Reconsulta o pagamento na API do Mercado Pago e sincroniza o banco. */
export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pagamentoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const mp = await import("./mercadopago.server");
    const admin = await mp.getAdmin();
    const { data: pagamento } = await admin.from("pagamentos").select("*").eq("id", data.pagamentoId).maybeSingle();
    if (!pagamento) throw new Error("Pagamento não encontrado.");
    if (pagamento.cliente_id !== context.userId) throw new Error("Sem permissão para este pagamento.");
    if (!pagamento.mp_payment_id || pagamento.status === "aprovado") return mp.toResumo(pagamento);
    const mpPayment = await mp.buscarPagamentoMp(pagamento.mp_payment_id);
    return mp.toResumo(await mp.aplicarStatusMp(admin, pagamento, mpPayment));
  });

/** Cancela um pagamento pendente (ex.: PIX expirado ou desistência). */
export const cancelPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pagamentoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const mp = await import("./mercadopago.server");
    const admin = await mp.getAdmin();
    const { data: pagamento } = await admin.from("pagamentos").select("*").eq("id", data.pagamentoId).maybeSingle();
    if (!pagamento) throw new Error("Pagamento não encontrado.");
    if (pagamento.cliente_id !== context.userId) throw new Error("Sem permissão para este pagamento.");
    if (pagamento.status !== "pendente") throw new Error("Somente pagamentos pendentes podem ser cancelados.");
    if (pagamento.mp_payment_id) {
      await mp.mpRequest(`/v1/payments/${pagamento.mp_payment_id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      }).catch((e) => console.error("[MercadoPago] cancelamento", e));
    }
    await admin.from("pagamentos").update({ status: "cancelado" }).eq("id", pagamento.id);
    return { ok: true };
  });

/** Estorno — restrito a administradores da plataforma. */
export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pagamentoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Ação permitida apenas para administradores.");

    const mp = await import("./mercadopago.server");
    const admin = await mp.getAdmin();
    const { data: pagamento } = await admin.from("pagamentos").select("*").eq("id", data.pagamentoId).maybeSingle();
    if (!pagamento?.mp_payment_id) throw new Error("Pagamento não encontrado.");
    if (pagamento.status !== "aprovado") throw new Error("Somente pagamentos aprovados podem ser estornados.");

    await mp.mpRequest(`/v1/payments/${pagamento.mp_payment_id}/refunds`, {
      method: "POST",
      idempotencyKey: `refund-${pagamento.external_reference}`,
      body: JSON.stringify({}),
    });
    await admin.from("pagamentos").update({ status: "estornado" }).eq("id", pagamento.id);
    await admin.from("contratos").update({ status: "disputado" }).eq("id", pagamento.contrato_id);
    return { ok: true };
  });

/** Solicitação de saque (estrutura pronta; sem integração bancária). */
export const solicitarSaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ valor: z.number().positive(), dadosBancarios: z.record(z.string(), z.string()).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const mp = await import("./mercadopago.server");
    const admin = await mp.getAdmin();
    const { data: prestador } = await admin.from("prestadores").select("id").eq("profile_id", context.userId).maybeSingle();
    if (!prestador) throw new Error("Apenas prestadores podem solicitar saque.");
    const { data: carteira } = await admin.from("carteiras").select("*").eq("prestador_id", prestador.id).maybeSingle();
    if (!carteira || Number(carteira.available_balance) < data.valor) throw new Error("Saldo insuficiente.");

    const disponivel = Math.round((Number(carteira.available_balance) - data.valor) * 100) / 100;
    const pendente = Math.round((Number(carteira.pending_balance) + data.valor) * 100) / 100;
    await admin.from("carteiras").update({ available_balance: disponivel, pending_balance: pendente }).eq("id", carteira.id);
    const { data: saque, error } = await admin
      .from("saques")
      .insert({ carteira_id: carteira.id, prestador_id: prestador.id, valor: data.valor, dados_bancarios: data.dadosBancarios ?? null })
      .select("id, valor, status")
      .single();
    if (error) throw new Error(error.message);
    await admin.from("carteira_transacoes").insert({
      carteira_id: carteira.id,
      tipo: "saque",
      valor: -data.valor,
      saldo_apos: disponivel,
      descricao: "Solicitação de saque",
    });
    return saque;
  });