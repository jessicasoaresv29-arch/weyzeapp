import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, MessageSquareWarning, CheckCircle2, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  abrirDisputa,
  concluirServico,
  confirmarConclusaoCliente,
  confirmarDinheiroPrestador,
  getPagamentoAtivo,
} from "@/lib/payments";

export const Route = createFileRoute("/_authenticated/app/chat/$id")({
  component: ChatConversation,
});

type Msg = { id: string; conversa_id: string; remetente_id: string; texto: string | null; created_at: string };

function ChatConversation() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const convQ = useQuery({
    queryKey: ["conversa", id], enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversas")
        .select("id, cliente_id, prestador_id, solicitacao_id, solicitacoes(titulo), prestadores(profile_id, profiles(nome, foto_url)), cliente:profiles!conversas_cliente_profile_fkey(nome, foto_url)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const conv: any = convQ.data;
  const contratoQ = useQuery({
    queryKey: ["contrato-por-solicitacao", conv?.solicitacao_id, conv?.cliente_id, conv?.prestador_id],
    enabled: !!conv?.solicitacao_id && !!conv?.cliente_id && !!conv?.prestador_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("contratos")
        .select("id, status, valor_final, cliente_id, prestador_id")
        .eq("solicitacao_id", conv.solicitacao_id)
        .eq("cliente_id", conv.cliente_id)
        .eq("prestador_id", conv.prestador_id)
        .order("created_at", { ascending: false })
        .maybeSingle();
      return data;
    },
  });
  const contrato: any = contratoQ.data;

  const pagQ = useQuery({
    queryKey: ["pagamento-ativo", contrato?.id],
    enabled: !!contrato?.id,
    queryFn: () => getPagamentoAtivo(contrato.id),
  });
  const pagamento: any = pagQ.data;

  useEffect(() => {
    if (!contrato?.id) return;
    const ch = supabase.channel(`contrato-${contrato.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "contratos", filter: `id=eq.${contrato.id}` },
        () => qc.invalidateQueries({ queryKey: ["contrato-por-solicitacao"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `contrato_id=eq.${contrato.id}` },
        () => qc.invalidateQueries({ queryKey: ["pagamento-ativo", contrato.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_confirmations" },
        () => qc.invalidateQueries({ queryKey: ["pagamento-ativo", contrato.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [contrato?.id, qc]);

  useEffect(() => {
    if (!id || !user) return;
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.from("mensagens").select("*").eq("conversa_id", id).order("created_at");
      if (error) {
        toast.error("Não foi possível carregar as mensagens.");
        return;
      }
      if (mounted) setMessages((data ?? []) as Msg[]);
    })();
    const channel = supabase.channel(`msg-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: `conversa_id=eq.${id}` }, (payload) => {
        const next = payload.new as Msg;
        setMessages((prev) => prev.some((m) => m.id === next.id) ? prev : [...prev, next]);
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          toast.error("Conexão do chat instável. Tentando sincronizar novamente.");
        }
      });
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [id, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user) return;
    const messageText = text.trim();
    setSending(true);
    const { data, error } = await supabase
      .from("mensagens")
      .insert({ conversa_id: id, remetente_id: user.id, texto: messageText, tipo: "texto" })
      .select("id, conversa_id, remetente_id, texto, created_at")
      .single();
    setSending(false);
    if (error) {
      toast.error(error.message || "Não foi possível enviar a mensagem.");
      return;
    }
    if (data) {
      setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data as Msg]);
    }
    setText("");
  }

  const isCliente = conv?.cliente_id === user?.id;
  const other = isCliente ? conv?.prestadores?.profiles : conv?.cliente;

  if (convQ.isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (convQ.isError || !conv) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 px-6 text-center">
        <MessageSquareWarning className="h-10 w-10 text-muted-foreground" />
        <p className="font-semibold">Não foi possível abrir esta conversa.</p>
        <p className="text-sm text-muted-foreground">Volte para a lista de conversas e tente novamente.</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/app/chat">Voltar ao chat</Link>
        </Button>
      </div>
    );
  }

  async function acao(fn: () => Promise<unknown>, ok: string) {
    setActing(true);
    try { await fn(); toast.success(ok); }
    catch (e: any) { toast.error(e.message ?? "Erro."); }
    finally { setActing(false); }
  }

  const cid = contrato?.id;
  const cst = contrato?.status;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link to="/app/chat" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {other?.foto_url
          ? <img src={other.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-white font-bold">{other?.nome?.[0]?.toUpperCase() ?? "?"}</div>}
        <div className="min-w-0">
          <p className="truncate font-semibold">{other?.nome ?? "Conversa"}</p>
          <p className="truncate text-xs text-muted-foreground">{conv?.solicitacoes?.titulo ?? ""}</p>
        </div>
      </header>

      {cid && cst && cst !== "pago" && cst !== "cancelado" && (
        <div className="border-b border-border bg-secondary/50 px-4 py-3">
          {!isCliente && (cst === "ativo" || cst === "em_andamento") && (
            <Button size="sm" className="w-full rounded-xl bg-success text-success-foreground hover:bg-success/90"
              disabled={acting} onClick={() => acao(() => concluirServico(cid), "Serviço concluído. Aguardando cliente.")}>
              <CheckCircle2 className="h-4 w-4" /> Concluir serviço
            </Button>
          )}
          {isCliente && cst === "aguardando_confirmacao_cliente" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">O serviço foi concluído?</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 rounded-xl bg-success text-success-foreground hover:bg-success/90"
                  disabled={acting} onClick={() => acao(() => confirmarConclusaoCliente(cid), "Confirmado. Escolha a forma de pagamento.")}>
                  Sim
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-xl"
                  disabled={acting} onClick={() => acao(() => abrirDisputa(cid, "Cliente reportou problema pelo chat."), "Problema reportado.")}>
                  <AlertTriangle className="h-4 w-4" /> Informar problema
                </Button>
              </div>
            </div>
          )}
          {isCliente && cst === "aguardando_pagamento" && (
            <Button size="sm" className="w-full rounded-xl bg-primary text-primary-foreground"
              onClick={() => navigate({ to: "/app/pagamento/$contratoId", params: { contratoId: cid } })}>
              <CreditCard className="h-4 w-4" /> Ir para pagamento
            </Button>
          )}
          {!isCliente && cst === "aguardando_pagamento" && pagamento?.forma === "dinheiro" && !pagamento?.cash_confirmations?.prestador_confirmou && (
            <Button size="sm" className="w-full rounded-xl bg-success text-success-foreground hover:bg-success/90"
              disabled={acting} onClick={() => acao(() => confirmarDinheiroPrestador(pagamento.id), "Você confirmou o recebimento em dinheiro.")}>
              Recebi em dinheiro
            </Button>
          )}
          {cst === "disputado" && (
            <p className="text-sm font-medium text-destructive">Contrato em disputa. Nossa equipe será notificada.</p>
          )}
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto bg-secondary/40 p-4">
        {messages.map((m) => {
          const mine = m.remetente_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${mine ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>
                {m.texto}
                <div className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-card p-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem…" className="h-12 rounded-full" />
        <Button type="submit" disabled={sending || !text.trim()} size="icon" className="h-12 w-12 rounded-full bg-success text-success-foreground hover:bg-success/90">
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </form>
    </div>
  );
}