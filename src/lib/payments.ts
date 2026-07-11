import { supabase } from "@/integrations/supabase/client";

export type FormaPagamento = "pix" | "credito" | "debito" | "dinheiro";

export type StatusPagamento =
  | "aguardando_pagamento"
  | "pendente"
  | "aprovado"
  | "recusado"
  | "dinheiro_pendente"
  | "concluido"
  | "em_analise"
  | "estornado"
  | "cancelado";

export const TAXA_WEYZE_PCT = 8;

export function calcularTaxa(valor: number) {
  const taxa = Math.round(valor * (TAXA_WEYZE_PCT / 100) * 100) / 100;
  return { taxa, liquido: Math.max(0, valor - taxa) };
}

export const STATUS_PAGAMENTO_LABEL: Record<StatusPagamento, { text: string; color: string }> = {
  aguardando_pagamento: { text: "Aguardando pagamento", color: "bg-amber-100 text-amber-700" },
  pendente: { text: "Pagamento pendente", color: "bg-amber-100 text-amber-700" },
  aprovado: { text: "Pagamento aprovado", color: "bg-emerald-100 text-emerald-700" },
  recusado: { text: "Pagamento recusado", color: "bg-destructive/10 text-destructive" },
  dinheiro_pendente: { text: "Aguardando confirmação em dinheiro", color: "bg-amber-100 text-amber-700" },
  concluido: { text: "Pagamento concluído", color: "bg-emerald-100 text-emerald-700" },
  em_analise: { text: "Em análise", color: "bg-muted text-muted-foreground" },
  estornado: { text: "Estornado", color: "bg-muted text-muted-foreground" },
  cancelado: { text: "Cancelado", color: "bg-muted text-muted-foreground" },
};

// -------------------------------------------------------------
// Gateway abstraction — Fase 1 = MockGateway.
// Trocar por StripeConnect / Mercado Pago / Asaas mantendo a mesma interface.
// -------------------------------------------------------------
export interface PaymentGateway {
  readonly name: string;
  /** Retorna quando o pagamento foi confirmado no gateway (mock resolve imediato). */
  confirmarPagamento(paymentId: string): Promise<void>;
}

class MockGateway implements PaymentGateway {
  readonly name = "mock";
  async confirmarPagamento(paymentId: string) {
    await new Promise((r) => setTimeout(r, 800)); // simula latência bancária
    const { error } = await supabase.rpc("confirmar_pagamento_mock" as any, { _payment_id: paymentId } as any);
    if (error) throw error;
  }
}

export const gateway: PaymentGateway = new MockGateway();

// -------------------------------------------------------------
// RPC wrappers
// -------------------------------------------------------------
async function rpc<T = unknown>(name: string, args: Record<string, unknown>) {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data as T;
}

export const concluirServico = (contratoId: string) =>
  rpc<void>("concluir_servico", { _contrato_id: contratoId });

export const confirmarConclusaoCliente = (contratoId: string) =>
  rpc<void>("confirmar_conclusao_cliente", { _contrato_id: contratoId });

export const abrirDisputa = (contratoId: string, motivo: string) =>
  rpc<void>("abrir_disputa", { _contrato_id: contratoId, _motivo: motivo });

export const iniciarPagamento = (contratoId: string, forma: FormaPagamento, parcelas = 1) =>
  rpc<string>("iniciar_pagamento", { _contrato_id: contratoId, _forma: forma, _parcelas: parcelas });

export const confirmarDinheiroPrestador = (paymentId: string) =>
  rpc<void>("confirmar_dinheiro_prestador", { _payment_id: paymentId });

export const confirmarDinheiroCliente = (paymentId: string) =>
  rpc<void>("confirmar_dinheiro_cliente", { _payment_id: paymentId });

// -------------------------------------------------------------
// Reads
// -------------------------------------------------------------
export async function getContrato(contratoId: string) {
  const { data, error } = await supabase
    .from("contratos")
    .select("id, status, valor_final, cliente_id, prestador_id, solicitacao_id, solicitacoes(titulo), prestadores(profile_id, profiles(nome, foto_url))")
    .eq("id", contratoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPagamentoAtivo(contratoId: string) {
  const { data, error } = await (supabase as any)
    .from("payments")
    .select("*, cash_confirmations(*)")
    .eq("contrato_id", contratoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getWallet(prestadorId: string) {
  const { data } = await (supabase as any)
    .from("wallets")
    .select("*")
    .eq("prestador_id", prestadorId)
    .maybeSingle();
  return data;
}

export async function getExtrato(prestadorId: string, limit = 100) {
  const { data, error } = await (supabase as any)
    .from("wallet_transactions")
    .select("*, payments(codigo_transacao, forma, cliente_id, profiles:cliente_id(nome))")
    .eq("prestador_id", prestadorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}