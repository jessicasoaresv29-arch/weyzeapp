import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, MapPin, Phone, CheckCheck, Check, CalendarCheck, PartyPopper } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/chat/")({
  component: ChatConversation,
});

type Msg = {
  id: string;
  conversa_id: string;
  remetente_id: string;
  texto: string | null;
  tipo: "texto" | "localizacao" | "contato" | "sistema";
  lida: boolean;
  lida_at: string | null;
  created_at: string;
};

const QUICK = [
  "Olá! Tenho interesse no serviço.",
  "Qual é o endereço?",
  "Qual o melhor horário?",
  "Posso realizar hoje.",
  "Proposta aceita.",
  "Serviço concluído.",
];

const STATUS_LABEL: Record<string, { label: string; className: string; Icon: any }> = {
  em_negociacao: { label: "Em negociação", className: "bg-emerald-500/10 text-emerald-600", Icon: PartyPopper },
  agendado: { label: "Serviço agendado", className: "bg-blue-500/10 text-blue-600", Icon: CalendarCheck },
  concluido: { label: "Serviço concluído", className: "bg-primary/10 text-primary", Icon: CheckCheck },
  cancelado: { label: "Cancelado", className: "bg-destructive/10 text-destructive", Icon: Check },
};

function ChatConversation() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const convQ = useQuery({
    queryKey: ["conversa", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversas")
        .select(
          "id, cliente_id, prestador_id, solicitacao_id, status_negociacao, solicitacoes(titulo, id), prestadores(profile_id, profiles(nome, foto_url, telefone)), cliente:profiles!conversas_cliente_profile_fkey(nome, foto_url, telefone)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Load & subscribe messages
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("mensagens")
        .select("id, conversa_id, remetente_id, texto, tipo, lida, lida_at, created_at")
        .eq("conversa_id", id)
        .order("created_at", { ascending: true });
      if (error) toast.error("Não foi possível carregar as mensagens");
      if (mounted) setMessages(((data ?? []) as Msg[]));
    })();

    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens", filter: `conversa_id=eq.${id}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Msg).id) ? prev : [...prev, payload.new as Msg],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensagens", filter: `conversa_id=eq.${id}` },
        (payload) => {
          const upd = payload.new as Msg;
          setMessages((prev) => prev.map((m) => (m.id === upd.id ? { ...m, ...upd } : m)));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Marca como lidas as mensagens do outro
  useEffect(() => {
    if (!user || messages.length === 0) return;
    const naoLidas = messages.filter((m) => m.remetente_id !== user.id && !m.lida).map((m) => m.id);
    if (naoLidas.length === 0) return;
    supabase
      .from("mensagens")
      .update({ lida: true, lida_at: new Date().toISOString() })
      .in("id", naoLidas)
      .then(() => {});
  }, [messages, user]);

  const conv = convQ.data;
  const isCliente = conv?.cliente_id === user?.id;
  const other = isCliente ? conv?.prestadores?.profiles : conv?.cliente;
  const statusInfo = STATUS_LABEL[conv?.status_negociacao ?? "em_negociacao"] ?? STATUS_LABEL.em_negociacao;

  const canFinalize = conv && conv.status_negociacao !== "concluido" && conv.status_negociacao !== "cancelado";

  async function insertMsg(payload: Partial<Msg>) {
    if (!user) return;
    setSending(true);
    const { error } = await supabase.from("mensagens").insert({
      conversa_id: id,
      remetente_id: user.id,
      tipo: payload.tipo ?? "texto",
      texto: payload.texto ?? null,
    });
    setSending(false);
    if (error) {
      toast.error(error.message || "Não foi possível enviar a mensagem");
      return false;
    }
    return true;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const val = text.trim();
    if (!val) return;
    const ok = await insertMsg({ texto: val, tipo: "texto" });
    if (ok) setText("");
  }

  async function sendLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocalização não disponível");
      return;
    }
    toast.loading("Obtendo sua localização…", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        toast.dismiss("geo");
        const link = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
        await insertMsg({ texto: link, tipo: "localizacao" });
      },
      () => {
        toast.dismiss("geo");
        toast.error("Não foi possível obter sua localização");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function sendContact() {
    const tel = profile?.telefone?.trim();
    if (!tel) {
      toast.error("Cadastre seu telefone no perfil para compartilhar.");
      return;
    }
    await insertMsg({ texto: tel, tipo: "contato" });
  }

  async function finalizar() {
    if (!conv) return;
    const { error } = await supabase
      .from("conversas")
      .update({ status_negociacao: "concluido" })
      .eq("id", conv.id);
    if (error) {
      toast.error("Não foi possível finalizar");
      return;
    }
    // registra mensagem de sistema
    await insertMsg({ texto: "Negociação finalizada. Serviço marcado como concluído.", tipo: "sistema" });
    toast.success("Negociação finalizada");
    convQ.refetch();
  }

  const items = useMemo(() => messages, [messages]);

  return (
    <div className="flex h-[100dvh] flex-col bg-secondary/40">
      <header className="flex flex-col gap-2 border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-3">
          <Link to="/app/chat" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {other?.foto_url ? (
            <img src={other.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient font-bold text-white">
              {other?.nome?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{other?.nome ?? "Conversa"}</p>
            <p className="truncate text-xs text-muted-foreground">{conv?.solicitacoes?.titulo ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${statusInfo.className}`}>
            <statusInfo.Icon className="h-3 w-3" /> {statusInfo.label}
          </span>
          {canFinalize && (
            <Button size="sm" variant="outline" onClick={finalizar} className="h-7 text-xs">
              Finalizar negociação
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {items.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Envie a primeira mensagem para começar a negociar.
          </p>
        )}
        {items.map((m) => {
          if (m.tipo === "sistema") {
            return (
              <div key={m.id} className="my-2 flex justify-center">
                <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">{m.texto}</span>
              </div>
            );
          }
          const mine = m.remetente_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  mine ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
                }`}
              >
                {m.tipo === "localizacao" ? (
                  <a href={m.texto ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline">
                    <MapPin className="h-4 w-4" /> Ver localização no mapa
                  </a>
                ) : m.tipo === "contato" ? (
                  <a href={`tel:${(m.texto ?? "").replace(/\D/g, "")}`} className="flex items-center gap-2 underline">
                    <Phone className="h-4 w-4" /> {m.texto}
                  </a>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                )}
                <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {mine && (m.lida ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showQuick && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-card p-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => {
                setText(q);
                setShowQuick(false);
              }}
              className="rounded-full bg-secondary px-3 py-1 text-xs hover:bg-secondary/70"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-card p-2">
        <button
          type="button"
          onClick={sendLocation}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
          title="Compartilhar localização"
        >
          <MapPin className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={sendContact}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
          title="Compartilhar contato"
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setShowQuick((v) => !v)}
          className="hidden h-10 shrink-0 items-center rounded-full bg-secondary px-3 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
        >
          Mensagens rápidas
        </button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setShowQuick(false)}
          placeholder="Escreva uma mensagem…"
          className="h-11 flex-1 rounded-full"
        />
        <Button
          type="submit"
          disabled={sending || !text.trim()}
          size="icon"
          className="h-11 w-11 rounded-full bg-success text-success-foreground hover:bg-success/90"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </form>
    </div>
  );
}
