/** Métodos de pagamento suportados (futuro). */
export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "CASH";

/** Status internos da plataforma para pagamentos. */
export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "FAILED"
  | "OVERDUE"
  | "CANCELED"
  | "REFUNDED"
  | "PENDING_CONFIRMATION";

/** Mapa de status do Asaas -> status interno. */
export const ASAAS_STATUS_MAP: Record<string, PaymentStatus> = {
  PENDING: "AWAITING_PAYMENT",
  AWAITING_RISK_ANALYSIS: "PROCESSING",
  APPROVED_BY_RISK_ANALYSIS: "PROCESSING",
  REPROVED_BY_RISK_ANALYSIS: "FAILED",
  AWAITING_CHARGEBACK_REVERSAL: "PROCESSING",
  CONFIRMED: "PENDING_CONFIRMATION",
  RECEIVED: "PAID",
  RECEIVED_IN_CASH: "PAID",
  OVERDUE: "OVERDUE",
  REFUNDED: "REFUNDED",
  REFUND_REQUESTED: "PROCESSING",
  CHARGEBACK_REQUESTED: "PROCESSING",
  CHARGEBACK_DISPUTE: "PROCESSING",
  DUNNING_REQUESTED: "PROCESSING",
  DUNNING_RECEIVED: "PAID",
  PAYMENT_DELETED: "CANCELED",
  CANCELED: "CANCELED",
};

export function mapAsaasStatus(status: string | undefined | null): PaymentStatus {
  if (!status) return "PENDING";
  return ASAAS_STATUS_MAP[status] ?? "PENDING";
}