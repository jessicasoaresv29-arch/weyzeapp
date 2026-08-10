import { useEffect, useState } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { CheckCircle2, Copy, Loader2, QrCode, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePagamento } from "@/hooks/use-pagamento";
import { useAsaasPix } from "@/hooks/use-asaas-pix";
import type { MetodoPagamento } from "@/lib/pagamentos.types";

let sdkIniciado = false;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratoId: string;
  valor: number;
  onPago?: () => void;
}

export function PagamentoDialog({ open, onOpenChange, contratoId, valor, onPago }: Props) {
  const { pagamento, publicKey, loading, erro, setErro, iniciar, pagarComCartao, cancelarPagamento } = usePagamento(contratoId);
  const pix = useAsaasPix(contratoId);
  const [metodo, setMetodo] = useState<MetodoPagamento | null>(null);

  useEffect(() => {
    if (publicKey && !sdkIniciado) {
      initMercadoPago(publicKey, { locale: "pt-BR" });
      sdkIniciado = true;
    }
  }, [publicKey]);

  useEffect(() => {
    if (pagamento?.status === "aprovado") {
      toast.success("Pagamento aprovado!");
      onPago?.();
    }
  }, [pagamento?.status, onPago]);

  useEffect(() => {
    if (pix.pago) {
      toast.success("Pagamento confirmado!");
      onPago?.();
    }
  }, [pix.pago, onPago]);

  async function escolher(m: MetodoPagamento) {
    setMetodo(m);
    if (m === "pix") {
      await pix.gerar();
      return;
    }
    await iniciar(m);
  }

  function copiarPix() {
    const codigo = pix.cobranca?.pixCopyPaste;
    if (!codigo) return;
    navigator.clipboard.writeText(codigo);
    toast.success("Código PIX copiado!");
  }

  const aprovado = pagamento?.status === "aprovado" || pix.pago;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setMetodo(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{aprovado ? "Pagamento confirmado" : "Pagar serviço"}</DialogTitle>
        </DialogHeader>

        {aprovado ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-14 w-14 text-success" />
            <p className="text-lg font-semibold">R$ {valor.toFixed(2)} pago</p>
            <p className="text-sm text-muted-foreground">O prestador já foi notificado e o valor foi creditado na carteira dele.</p>
            <Button className="mt-2 w-full rounded-xl" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-secondary p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor do serviço</p>
              <p className="text-2xl font-bold text-foreground">R$ {valor.toFixed(2)}</p>
            </div>

        {(erro || pix.erro) && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro ?? pix.erro}</span>
              </div>
            )}

            {!metodo && (
              <div className="grid gap-2">
                <Button className="h-12 rounded-xl bg-success text-success-foreground hover:bg-success/90" onClick={() => escolher("pix")}>
                  <QrCode className="h-5 w-5" /> Pagar com PIX
                </Button>
                <Button variant="outline" className="h-12 rounded-xl" onClick={() => escolher("credit_card")}>
                  Cartão de crédito ou débito
                </Button>
              </div>
            )}

            {(loading || pix.loading) && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {metodo === "pix" && pix.cobranca && !pix.loading && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-semibold text-foreground">Pague via PIX</p>
                {pix.cobranca.qrCodeBase64 && (
                  <img src={`data:image/png;base64,${pix.cobranca.qrCodeBase64}`} alt="QR Code PIX" className="h-52 w-52 rounded-xl border border-border" />
                )}
                <p className="text-center text-sm text-muted-foreground">Escaneie o QR Code ou use o código copia e cola.</p>
                <Button variant="outline" className="w-full rounded-xl" disabled={!pix.cobranca.pixCopyPaste} onClick={copiarPix}>
                  <Copy className="h-4 w-4" /> Copiar código PIX
                </Button>
                <p className="text-xs text-muted-foreground">Aguardando pagamento…</p>
              </div>
            )}

            {metodo === "credit_card" && pagamento && publicKey && !loading && (
              <Payment
                initialization={{ amount: valor }}
                customization={{
                  paymentMethods: { creditCard: "all", debitCard: "all" },
                  visual: { style: { theme: "default" } },
                }}
                onSubmit={async (params: any) => {
                  const dados = params.formData ?? params;
                  await pagarComCartao(dados);
                }}
                onError={() => setErro("Não foi possível validar os dados do cartão.")}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}