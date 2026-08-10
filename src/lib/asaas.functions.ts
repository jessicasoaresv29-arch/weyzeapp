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