// Camada de acesso ao Asaas. SERVER-ONLY: a API Key nunca sai daqui.
// Nesta etapa a infraestrutura está pronta, mas nenhuma cobrança real é criada.

const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_URL = "https://api.asaas.com/v3";
const TIMEOUT_MS = 12_000;

export function asaasAmbiente(): "sandbox" | "production" {
  return process.env.ASAAS_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function asaasBaseUrl(): string {
  return asaasAmbiente() === "production" ? PRODUCTION_URL : SANDBOX_URL;
}

function apiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("Pagamentos indisponíveis: credencial do Asaas não configurada.");
  return key;
}

/** True quando a integração já pode chamar a API (secret presente). */
export function asaasConfigurado(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}

/** Log seguro: nunca imprime a API Key nem dados sensíveis do pagador. */
export function logSeguro(escopo: string, dados: Record<string, unknown> = {}) {
  const limpo: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (/key|token|secret|authorization|cpf|cnpj|card/i.test(k)) continue;
    limpo[k] = v;
  }
  console.log(`[Asaas] ${escopo}`, JSON.stringify(limpo));
}

/** Requisição à API do Asaas com timeout, retry e idempotência opcional. */
export async function asaasRequest<T = any>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
  tentativa = 0,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${asaasBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "Weyze/1.0 (Node.js; sandbox)",
        access_token: apiKey(),
        "Content-Type": "application/json",
        ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 429;
      if (retryable && tentativa < 2) {
        await new Promise((r) => setTimeout(r, 400 * (tentativa + 1)));
        return asaasRequest<T>(path, init, tentativa + 1);
      }
      const msg = (body as any)?.errors?.[0]?.description ?? "Falha na comunicação com o Asaas.";
      logSeguro("erro", { path, status: res.status, msg });
      throw new Error(msg);
    }
    return body as T;
  } catch (error: any) {
    if (error?.name === "AbortError" && tentativa < 2) {
      return asaasRequest<T>(path, init, tentativa + 1);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Consulta uma cobrança no Asaas (fonte de verdade para o webhook). */
export async function buscarCobranca(paymentId: string) {
  return asaasRequest<any>(`/payments/${paymentId}`, { method: "GET" });
}

/** Registra o evento do webhook; retorna false se já foi processado (idempotência). */
export async function registrarEvento(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  evento: { eventId: string; eventType?: string; paymentId?: string; payload: unknown },
): Promise<boolean> {
  const { error } = await admin.from("payment_events" as any).insert({
    provider: "asaas",
    event_id: evento.eventId,
    event_type: evento.eventType ?? null,
    asaas_payment_id: evento.paymentId ?? null,
    payload: evento.payload as any,
  });
  return !error;
}

export async function marcarEventoProcessado(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  eventId: string,
  erro?: string,
) {
  await admin
    .from("payment_events" as any)
    .update({ processed: !erro, error: erro ?? null })
    .eq("provider", "asaas")
    .eq("event_id", eventId);
}
/* ------------------------------------------------------------------ *
 * PIX — criação de cobrança e aplicação de status (fonte: API Asaas)  *
 * ------------------------------------------------------------------ */

export interface AsaasPixQr {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
}

/** Cria uma cobrança PIX no Asaas. */
export async function criarCobrancaPix(params: {
  customerId: string;
  valor: number;
  descricao: string;
  externalReference: string;
  vencimento: string; // YYYY-MM-DD
}) {
  return asaasRequest<any>("/payments", {
    method: "POST",
    idempotencyKey: `pix-${params.externalReference}`,
    body: JSON.stringify({
      customer: params.customerId,
      billingType: "PIX",
      value: Number(params.valor.toFixed(2)),
      dueDate: params.vencimento,
      description: params.descricao,
      externalReference: params.externalReference,
    }),
  });
}

/** Busca o QR Code PIX de uma cobrança (fica pronto poucos instantes após a criação). */
export async function buscarQrCodePix(paymentId: string, tentativas = 3): Promise<AsaasPixQr | null> {
  for (let i = 0; i < tentativas; i++) {
    try {
      const qr = await asaasRequest<AsaasPixQr>(`/payments/${paymentId}/pixQrCode`, { method: "GET" });
      if (qr?.payload) return qr;
    } catch {
      /* tenta novamente */
    }
    await new Promise((r) => setTimeout(r, 900));
  }
  return null;
}

/**
 * Registra o valor líquido do prestador como SALDO AGUARDANDO LIQUIDAÇÃO.
 * NÃO disponibiliza para saque: `available_balance` não é tocado.
 * Executado uma única vez por pagamento (idempotente por pagamento_id).
 */
async function registrarLiquidacaoPendente(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  pagamento: any,
) {
  const { data: existente } = await admin
    .from("carteira_transacoes" as any)
    .select("id")
    .eq("pagamento_id", pagamento.id)
    .maybeSingle();
  if (existente) return;

  let { data: carteira } = await admin
    .from("carteiras" as any)
    .select("id, available_balance, total_balance, settlement_pending_balance")
    .eq("prestador_id", pagamento.prestador_id)
    .maybeSingle();

  if (!carteira) {
    const criada = await admin
      .from("carteiras" as any)
      .insert({ prestador_id: pagamento.prestador_id })
      .select("id, available_balance, total_balance, settlement_pending_balance")
      .single();
    carteira = criada.data as any;
  }
  if (!carteira) return;

  const liquido = Math.round(Number(pagamento.valor_prestador ?? 0) * 100) / 100;
  const disponivel = Number((carteira as any).available_balance ?? 0); // inalterado
  const aguardando =
    Math.round((Number((carteira as any).settlement_pending_balance ?? 0) + liquido) * 100) / 100;

  await admin
    .from("carteiras" as any)
    .update({
      settlement_pending_balance: aguardando,
      total_balance: Math.round((Number((carteira as any).total_balance ?? 0) + liquido) * 100) / 100,
    })
    .eq("id", (carteira as any).id);

  // Registro financeiro de auditoria — não representa saldo disponível.
  await admin.from("carteira_transacoes" as any).insert({
    carteira_id: (carteira as any).id,
    pagamento_id: pagamento.id,
    tipo: "credito",
    valor: liquido,
    saldo_apos: disponivel,
    descricao: "Pagamento PIX confirmado (Asaas) — aguardando liquidação",
  });
}

/**
 * Aplica no banco o status retornado pela API oficial do Asaas.
 * Nunca é chamado com dados vindos do frontend.
 */
export async function aplicarStatusCobranca(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  cobranca: any,
) {
  const { mapAsaasStatus } = await import("./asaas.types");
  const externo = mapAsaasStatus(cobranca?.status);

  const { data: pagamento } = await admin
    .from("pagamentos" as any)
    .select("*")
    .eq("asaas_payment_id", cobranca?.id)
    .maybeSingle();
  if (!pagamento) return null;

  const pago = externo === "PAID";
  const statusInterno = pago
    ? "aprovado"
    : externo === "REFUNDED"
      ? "estornado"
      : externo === "CANCELED"
        ? "cancelado"
        : externo === "OVERDUE"
          ? "expirado"
          : "pendente";

  const agora = new Date().toISOString();
  await admin
    .from("pagamentos" as any)
    .update({
      status: statusInterno,
      approved_at: pago ? ((pagamento as any).approved_at ?? agora) : (pagamento as any).approved_at,
      paid_at: pago ? ((pagamento as any).paid_at ?? agora) : (pagamento as any).paid_at,
      refunded_at: externo === "REFUNDED" ? agora : (pagamento as any).refunded_at,
      raw: cobranca,
    })
    .eq("id", (pagamento as any).id);

  if (pago) {
    // Confirma o pagamento e registra o líquido como pendente de liquidação.
    // Nenhum saque, transferência ou split é executado aqui.
    await registrarLiquidacaoPendente(admin, pagamento);
    await admin
      .from("contratos")
      .update({ status: "pago" as any })
      .eq("id", (pagamento as any).contrato_id);
  }

  logSeguro("status-aplicado", { pagamentoId: (pagamento as any).id, externo });
  return { pagamentoId: (pagamento as any).id, status: statusInterno, statusExterno: externo };
}
