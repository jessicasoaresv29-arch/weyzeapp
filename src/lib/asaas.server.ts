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