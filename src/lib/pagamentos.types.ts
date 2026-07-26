export type MetodoPagamento = "pix" | "credit_card" | "debit_card";

export type StatusPagamento =
  | "pendente"
  | "aprovado"
  | "recusado"
  | "cancelado"
  | "estornado"
  | "expirado";

export interface PagamentoResumo {
  id: string;
  contrato_id: string;
  valor: number;
  status: StatusPagamento;
  metodo: MetodoPagamento;
  external_reference: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expires_at: string | null;
  approved_at: string | null;
  valor_comissao: number;
  valor_prestador: number;
  detalhe_erro: string | null;
}

export const STATUS_CONTRATO_PAGAVEL = "aguardando_pagamento";