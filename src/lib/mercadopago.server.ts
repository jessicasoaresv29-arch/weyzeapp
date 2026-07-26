// Camada de acesso ao Mercado Pago + regras financeiras.
// Server-only: nunca importar em componentes (o Access Token vive aqui).
import type { MetodoPagamento, PagamentoResumo } from "./pagamentos.types";

const MP_API = "https://api.mercadopago.com";
const TIMEOUT_MS = 12_000;

function accessToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Pagamentos indisponíveis: credencial do Mercado Pago não configurada.");
  return token;
}

export function publicKey(): string {
  return process.env.MERCADO_PAGO_PUBLIC_KEY ?? "";
}

/** Chamada à API do MP com timeout e retry para falhas transitórias. */
export async function mpRequest<T = any>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
  tentativa = 0,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${MP_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        "Content-Type": "application/json",
        ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 429;
      if (retryable && tentativa < 2) {
        await new Promise((r) => setTimeout(r, 400 * (tentativa + 1)));
        return mpRequest<T>(path, init, tentativa + 1);
      }
      console.error("[MercadoPago] erro", res.status, JSON.stringify(body));
      throw new Error((body as any)?.message ?? "Falha na comunicação com o Mercado Pago.");
    }
    return body as T;
  } catch (error: any) {
    if (error?.name === "AbortError" && tentativa < 2) {
      return mpRequest<T>(path, init, tentativa + 1);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function buscarPagamentoMp(mpPaymentId: string) {
  return mpRequest<any>(`/v1/payments/${mpPaymentId}`, { method: "GET" });
}

export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Percentual de comissão parametrizado no banco (nunca fixo no código). */
export async function getComissaoPercentual(admin: any): Promise<number> {
  const { data } = await admin
    .from("configuracoes_plataforma")
    .select("valor")
    .eq("chave", "comissao_percentual")
    .maybeSingle();
  return Number(data?.valor ?? 8);
}

export function calcularComissao(valor: number, percentual: number) {
  const comissao = Math.round(valor * percentual) / 100;
  return { valor_comissao: comissao, valor_prestador: Math.round((valor - comissao) * 100) / 100 };
}

export function toResumo(row: any): PagamentoResumo {
  return {
    id: row.id,
    contrato_id: row.contrato_id,
    valor: Number(row.valor),
    status: row.status,
    metodo: row.metodo as MetodoPagamento,
    external_reference: row.external_reference,
    qr_code: row.qr_code ?? null,
    qr_code_base64: row.qr_code_base64 ?? null,
    ticket_url: row.ticket_url ?? null,
    expires_at: row.expires_at ?? null,
    approved_at: row.approved_at ?? null,
    valor_comissao: Number(row.valor_comissao ?? 0),
    valor_prestador: Number(row.valor_prestador ?? 0),
    detalhe_erro: row.detalhe_erro ?? null,
  };
}

/** Carrega o contrato e valida se ele pode ser pago pelo usuário informado. */
export async function carregarContratoPagavel(admin: any, contratoId: string, userId: string) {
  const { data: contrato, error } = await admin
    .from("contratos")
    .select("id, cliente_id, prestador_id, valor_final, status")
    .eq("id", contratoId)
    .maybeSingle();
  if (error || !contrato) throw new Error("Contrato não encontrado.");
  if (contrato.cliente_id !== userId) throw new Error("Você não tem permissão para pagar este contrato.");
  if (contrato.status === "disputado") throw new Error("Contrato em disputa: pagamento bloqueado.");
  if (contrato.status === "pago") throw new Error("Este serviço já foi pago.");
  if (contrato.status !== "aguardando_pagamento") throw new Error("O pagamento só é liberado após a confirmação da conclusão do serviço.");
  const valor = Number(contrato.valor_final ?? 0);
  if (!valor || valor <= 0) throw new Error("Valor do contrato inválido.");
  return { contrato, valor };
}

/** Retorna o pagamento ativo do contrato (pendente/aprovado), expirando PIX vencido. */
export async function pagamentoAtivo(admin: any, contratoId: string) {
  const { data } = await admin
    .from("pagamentos")
    .select("*")
    .eq("contrato_id", contratoId)
    .in("status", ["pendente", "aprovado"])
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (!data) return null;
  const expirado = data.status === "pendente" && data.expires_at && new Date(data.expires_at).getTime() < Date.now();
  if (expirado) {
    await admin.from("pagamentos").update({ status: "expirado" }).eq("id", data.id);
    return null;
  }
  return data;
}

export async function criarRegistroPagamento(
  admin: any,
  params: { contrato: any; valor: number; metodo: MetodoPagamento },
) {
  const percentual = await getComissaoPercentual(admin);
  const { valor_comissao, valor_prestador } = calcularComissao(params.valor, percentual);
  const externalReference = crypto.randomUUID();
  const { data, error } = await admin
    .from("pagamentos")
    .insert({
      contrato_id: params.contrato.id,
      cliente_id: params.contrato.cliente_id,
      prestador_id: params.contrato.prestador_id,
      valor: params.valor,
      metodo: params.metodo,
      status: "pendente",
      external_reference: externalReference,
      comissao_percentual: percentual,
      valor_comissao,
      valor_prestador,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function creditarCarteira(admin: any, pagamento: any) {
  const { data: carteiraExistente } = await admin
    .from("carteiras")
    .select("*")
    .eq("prestador_id", pagamento.prestador_id)
    .maybeSingle();

  let carteira = carteiraExistente;
  if (!carteira) {
    const { data, error } = await admin
      .from("carteiras")
      .insert({ prestador_id: pagamento.prestador_id })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    carteira = data;
  }

  const liquido = Number(pagamento.valor_prestador);
  const disponivel = Math.round((Number(carteira.available_balance) + liquido) * 100) / 100;
  const total = Math.round((Number(carteira.total_balance) + liquido) * 100) / 100;

  await admin.from("carteiras").update({ available_balance: disponivel, total_balance: total }).eq("id", carteira.id);
  await admin.from("carteira_transacoes").insert({
    carteira_id: carteira.id,
    pagamento_id: pagamento.id,
    tipo: "credito",
    valor: liquido,
    saldo_apos: disponivel,
    descricao: `Pagamento recebido (comissão ${pagamento.comissao_percentual}%)`,
  });
}

/**
 * Reconciliação: aplica no banco o estado real consultado na API do Mercado Pago.
 * Idempotente — se o pagamento já está aprovado, nada é refeito.
 */
export async function aplicarStatusMp(admin: any, pagamentoRow: any, mpPayment: any) {
  if (pagamentoRow.status === "aprovado") return pagamentoRow;

  const mapa: Record<string, string> = {
    approved: "aprovado",
    authorized: "pendente",
    in_process: "pendente",
    pending: "pendente",
    rejected: "recusado",
    cancelled: "cancelado",
    refunded: "estornado",
    charged_back: "estornado",
  };
  const novoStatus = mapa[mpPayment.status] ?? "pendente";

  // Proteção contra alteração de valor: o valor cobrado deve bater com o registro.
  const valorMp = Number(mpPayment.transaction_amount ?? 0);
  if (novoStatus === "aprovado" && Math.abs(valorMp - Number(pagamentoRow.valor)) > 0.01) {
    await admin.from("pagamentos").update({ status: "recusado", detalhe_erro: "Divergência de valor" }).eq("id", pagamentoRow.id);
    throw new Error("Divergência de valor no pagamento.");
  }

  const patch: Record<string, unknown> = {
    status: novoStatus,
    mp_payment_id: String(mpPayment.id),
    payment_type: mpPayment.payment_type_id ?? null,
    payment_method: mpPayment.payment_method_id ?? null,
    detalhe_erro: mpPayment.status_detail ?? null,
    raw: mpPayment,
  };
  if (novoStatus === "aprovado") patch.approved_at = mpPayment.date_approved ?? new Date().toISOString();

  const { data: atualizado, error } = await admin
    .from("pagamentos")
    .update(patch)
    .eq("id", pagamentoRow.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (novoStatus === "aprovado") {
    await admin.from("contratos").update({ status: "pago", data_final: new Date().toISOString() }).eq("id", atualizado.contrato_id);
    await creditarCarteira(admin, atualizado);
    await notificarPagamento(admin, atualizado);
  }
  return atualizado;
}

async function notificarPagamento(admin: any, pagamento: any) {
  const { data: prestador } = await admin
    .from("prestadores")
    .select("profile_id")
    .eq("id", pagamento.prestador_id)
    .maybeSingle();
  const valor = Number(pagamento.valor).toFixed(2);
  const alvos: Array<[string, string, string]> = [];
  if (prestador?.profile_id) {
    alvos.push([prestador.profile_id, "Pagamento recebido", `R$ ${valor} pago pelo cliente. Saldo creditado na sua carteira.`]);
  }
  alvos.push([pagamento.cliente_id, "Pagamento aprovado", `Seu pagamento de R$ ${valor} foi aprovado.`]);
  for (const [usuario, titulo, mensagem] of alvos) {
    await admin.from("notificacoes").insert({ usuario_id: usuario, titulo, mensagem, tipo: "pagamento", link: "/app/chat" });
  }
}