import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Diagnóstico da integração (não expõe a API Key, apenas se está configurada). */
export const asaasStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const asaas = await import("./asaas.server");
    return { configurado: asaas.asaasConfigurado(), ambiente: asaas.asaasAmbiente() };
  });

/**
 * create-asaas-customer — garante o cliente Asaas do usuário autenticado.
 * Estrutura pronta; a chamada real à API só ocorre quando ASAAS_API_KEY existir.
 */
export const createAsaasCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ cpfCnpj: z.string().min(11).max(18).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const asaas = await import("./asaas.server");
    const admin = await asaas.getAdmin();

    const { data: perfil } = await admin
      .from("profiles")
      .select("id, nome, email, telefone, asaas_customer_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!perfil) throw new Error("Perfil não encontrado.");
    if ((perfil as any).asaas_customer_id) {
      return { customerId: (perfil as any).asaas_customer_id as string, criado: false };
    }

    if (!asaas.asaasConfigurado()) {
      asaas.logSeguro("create-customer:pendente", { userId: context.userId });
      throw new Error("Integração Asaas ainda não configurada (ASAAS_API_KEY ausente).");
    }

    const cliente = await asaas.asaasRequest<any>("/customers", {
      method: "POST",
      idempotencyKey: `customer-${context.userId}`,
      body: JSON.stringify({
        name: perfil.nome,
        email: perfil.email ?? undefined,
        mobilePhone: perfil.telefone ?? undefined,
        cpfCnpj: data.cpfCnpj,
        externalReference: context.userId,
      }),
    });

    await admin.from("profiles").update({ asaas_customer_id: cliente.id } as any).eq("id", context.userId);
    asaas.logSeguro("create-customer:ok", { userId: context.userId });
    return { customerId: cliente.id as string, criado: true };
  });

/**
 * create-asaas-payment — estrutura da cobrança (PIX/Cartão/Dinheiro).
 * Nesta etapa a criação real está desativada por segurança.
 */
export const createAsaasPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contratoId: z.string().uuid(),
        billingType: z.enum(["PIX", "CREDIT_CARD", "CASH"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const asaas = await import("./asaas.server");
    const admin = await asaas.getAdmin();

    const { data: contrato } = await admin
      .from("contratos")
      .select("id, cliente_id, prestador_id, valor_final, status")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");
    if (contrato.cliente_id !== context.userId) throw new Error("Sem permissão para este contrato.");

    asaas.logSeguro("create-payment:preparado", {
      contratoId: contrato.id,
      billingType: data.billingType,
      ambiente: asaas.asaasAmbiente(),
    });

    throw new Error("Cobranças Asaas ainda não estão ativadas nesta etapa da integração.");
  });
/* ------------------------------------------------------------------ *
 * PIX (Asaas Sandbox) — etapa 1: somente PIX, sem split e sem cartão. *
 * ------------------------------------------------------------------ */

const CPF_SANDBOX = "24971563792"; // CPF de teste público do Asaas (apenas sandbox)

/** Garante o cliente Asaas do usuário autenticado (uso interno das server fns). */
async function garantirCliente(admin: any, userId: string, cpfCnpj?: string) {
  const asaas = await import("./asaas.server");
  const { data: perfil } = await admin
    .from("profiles")
    .select("id, nome, email, telefone, asaas_customer_id")
    .eq("id", userId)
    .maybeSingle();
  if (!perfil) throw new Error("Perfil não encontrado.");
  if (perfil.asaas_customer_id) return perfil.asaas_customer_id as string;

  const documento = cpfCnpj ?? (asaas.asaasAmbiente() === "sandbox" ? CPF_SANDBOX : undefined);
  if (!documento) throw new Error("Informe seu CPF/CNPJ para gerar a cobrança.");

  const cliente = await asaas.asaasRequest<any>("/customers", {
    method: "POST",
    idempotencyKey: `customer-${userId}`,
    body: JSON.stringify({
      name: perfil.nome,
      email: perfil.email ?? undefined,
      mobilePhone: perfil.telefone ?? undefined,
      cpfCnpj: documento,
      externalReference: userId,
    }),
  });
  await admin.from("profiles").update({ asaas_customer_id: cliente.id }).eq("id", userId);
  return cliente.id as string;
}

function resumoPix(p: any) {
  return {
    id: p.id as string,
    contratoId: p.contrato_id as string,
    valor: Number(p.valor),
    status: p.status as string,
    statusExterno: p.status === "aprovado" ? "PAID" : "AWAITING_PAYMENT",
    metodo: "pix" as const,
    provedor: "asaas" as const,
    asaasPaymentId: (p.asaas_payment_id ?? null) as string | null,
    pixCopyPaste: (p.pix_copy_paste ?? null) as string | null,
    qrCodeBase64: (p.qr_code_base64 ?? null) as string | null,
    paymentUrl: (p.ticket_url ?? null) as string | null,
    expiresAt: (p.expires_at ?? null) as string | null,
    valorComissao: Number(p.valor_comissao ?? 0),
    valorPrestador: Number(p.valor_prestador ?? 0),
  };
}

/**
 * createAsaasPixCharge — cria (ou reaproveita) a cobrança PIX de um contrato concluído.
 * Valor e partes são lidos SEMPRE do banco; o frontend só envia o id do contrato.
 */
export const createAsaasPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ contratoId: z.string().uuid(), cpfCnpj: z.string().min(11).max(18).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const asaas = await import("./asaas.server");
    const admin = await asaas.getAdmin();
    if (!asaas.asaasConfigurado()) throw new Error("Pagamentos indisponíveis no momento.");

    const { data: contrato } = await admin
      .from("contratos")
      .select("id, cliente_id, prestador_id, valor_final, status")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");
    if (contrato.cliente_id !== context.userId) throw new Error("Sem permissão para este contrato.");

    const pagavel = ["concluido", "aguardando_pagamento", "aguardando_confirmacao_cliente"];
    if (!pagavel.includes(String(contrato.status))) {
      throw new Error("O serviço precisa estar concluído para ser pago.");
    }
    const valor = Number(contrato.valor_final ?? 0);
    if (!(valor > 0)) throw new Error("Valor do serviço indisponível.");
    if (valor < 5) throw new Error("O valor mínimo para pagamento via PIX é R$ 5,00.");

    // Duplicidade: reaproveita cobrança ativa do mesmo contrato.
    const { data: existente } = await admin
      .from("pagamentos" as any)
      .select("*")
      .eq("contrato_id", contrato.id)
      .in("status", ["pendente", "aprovado"])
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (existente && (existente as any).provedor === "asaas") {
      return resumoPix(existente);
    }
    if (existente) throw new Error("Já existe um pagamento em andamento para este serviço.");

    const { data: config } = await admin
      .from("configuracoes_plataforma")
      .select("valor")
      .eq("chave", "comissao_percentual")
      .maybeSingle();
    const comissaoPct = Number(config?.valor ?? 8);
    const valorComissao = Number(((valor * comissaoPct) / 100).toFixed(2));
    const valorPrestador = Number((valor - valorComissao).toFixed(2));

    const customerId = await garantirCliente(admin, context.userId, data.cpfCnpj);
    const externalReference = `weyze-${contrato.id}-${Date.now()}`;
    const vencimento = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const cobranca = await asaas.criarCobrancaPix({
      customerId,
      valor,
      descricao: `Serviço Weyze ${contrato.id.slice(0, 8)}`,
      externalReference,
      vencimento,
    });
    const qr = await asaas.buscarQrCodePix(cobranca.id);

    const { data: pagamento, error } = await admin
      .from("pagamentos" as any)
      .insert({
        contrato_id: contrato.id,
        cliente_id: contrato.cliente_id,
        prestador_id: contrato.prestador_id,
        valor,
        status: "pendente", // AWAITING_PAYMENT
        metodo: "pix",
        payment_method: "PIX",
        provedor: "asaas",
        asaas_customer_id: customerId,
        asaas_payment_id: cobranca.id,
        external_reference: externalReference,
        pix_copy_paste: qr?.payload ?? null,
        qr_code_base64: qr?.encodedImage ?? null,
        ticket_url: cobranca.invoiceUrl ?? null,
        expires_at: qr?.expirationDate ? new Date(qr.expirationDate).toISOString() : null,
        comissao_percentual: comissaoPct,
        valor_comissao: valorComissao,
        valor_prestador: valorPrestador,
      })
      .select("*")
      .single();
    if (error) throw new Error("Não foi possível registrar o pagamento.");

    await admin.from("contratos").update({ status: "aguardando_pagamento" as any }).eq("id", contrato.id);
    asaas.logSeguro("pix:criado", { pagamentoId: (pagamento as any).id, ambiente: asaas.asaasAmbiente() });
    return resumoPix(pagamento);
  });

/** syncAsaasPixCharge — reconsulta oficial na API do Asaas e aplica o status real. */
export const syncAsaasPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pagamentoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const asaas = await import("./asaas.server");
    const admin = await asaas.getAdmin();

    const { data: pagamento } = await admin
      .from("pagamentos" as any)
      .select("*")
      .eq("id", data.pagamentoId)
      .maybeSingle();
    if (!pagamento) throw new Error("Pagamento não encontrado.");
    if ((pagamento as any).cliente_id !== context.userId) throw new Error("Sem permissão.");

    if ((pagamento as any).asaas_payment_id && asaas.asaasConfigurado()) {
      const cobranca = await asaas.buscarCobranca((pagamento as any).asaas_payment_id);
      await asaas.aplicarStatusCobranca(admin, cobranca);

      // Backfill: o QR Code pode ficar pronto alguns segundos após a criação.
      if (!(pagamento as any).pix_copy_paste) {
        const qr = await asaas.buscarQrCodePix((pagamento as any).asaas_payment_id, 1);
        if (qr?.payload) {
          await admin
            .from("pagamentos" as any)
            .update({ pix_copy_paste: qr.payload, qr_code_base64: qr.encodedImage ?? null })
            .eq("id", (pagamento as any).id);
        }
      }
    }

    const { data: atualizado } = await admin
      .from("pagamentos" as any)
      .select("*")
      .eq("id", data.pagamentoId)
      .maybeSingle();
    return resumoPix(atualizado ?? pagamento);
  });
