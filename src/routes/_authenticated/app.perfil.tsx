import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, ListChecks, Check, Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCategorias } from "@/lib/data";
import { ensurePrestador } from "@/lib/prestador";
import { CategoriaIcon } from "@/components/categoria-icon";
import {
  notificationPermission,
  requestNotificationPermission,
  notificationsSupported,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/app/perfil")({
  component: Perfil,
});

function Perfil() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [prestadorId, setPrestadorId] = useState<string | null>(null);
  const [selCats, setSelCats] = useState<Set<string>>(new Set());
  const [savingCats, setSavingCats] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(
    notificationPermission(),
  );

  async function ativarNotificacoes() {
    if (!notificationsSupported()) {
      toast.error("Seu navegador não suporta notificações. No iPhone, adicione o app à tela inicial primeiro.");
      return;
    }
    const p = await requestNotificationPermission();
    setNotifPerm(p);
    if (p === "granted") toast.success("Notificações ativadas!");
    else if (p === "denied") toast.error("Permissão negada. Ative nas configurações do navegador.");
  }

  const isPrestador = profile?.tipo_usuario === "prestador";
  const catsQ = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias, enabled: isPrestador });

  useEffect(() => {
    if (!user || !isPrestador) return;
    (async () => {
      const p = await ensurePrestador(user.id);
      setPrestadorId(p.id);
      setSelCats(new Set((p.prestador_categorias ?? []).map((c: any) => c.categoria_id)));
    })();
  }, [user, isPrestador]);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setTelefone(profile.telefone ?? "");
      setCidade(profile.cidade ?? "");
      setEstado(profile.estado ?? "");
      setDescricao(profile.descricao ?? "");
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome, telefone, cidade, estado, descricao })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  }

  function toggleCat(id: string) {
    setSelCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function salvarCategorias() {
    if (!prestadorId) return;
    if (selCats.size === 0) return toast.error("Escolha ao menos 1 categoria.");
    setSavingCats(true);
    const del = await supabase.from("prestador_categorias").delete().eq("prestador_id", prestadorId);
    if (del.error) { setSavingCats(false); return toast.error(del.error.message); }
    const rows = Array.from(selCats).map((cid) => ({ prestador_id: prestadorId, categoria_id: cid }));
    const { error } = await supabase.from("prestador_categorias").insert(rows);
    setSavingCats(false);
    if (error) return toast.error(error.message);
    toast.success("Categorias atualizadas");
    qc.invalidateQueries();
  }

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial = nome?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex flex-col gap-6">
      <header className="px-6 pt-8">
        <h1 className="text-2xl font-bold">Meu perfil</h1>
      </header>

      <section className="flex items-center gap-4 px-6">
        {profile?.foto_url ? (
          <img src={profile.foto_url} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-gradient text-2xl font-bold text-white">
            {initial}
          </div>
        )}
        <div>
          <p className="text-lg font-semibold">{profile?.nome || "—"}</p>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <span className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize">
            {profile?.tipo_usuario}
          </span>
        </div>
      </section>

      <section className="space-y-4 px-6 pb-6">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tel">Telefone</Label>
          <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="cidade">Cidade</Label>
            <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} className="h-12 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estado">UF</Label>
            <Input id="estado" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} className="h-12 rounded-xl uppercase" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Sobre você</Label>
          <Textarea id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className="rounded-xl" />
        </div>

        <Button onClick={save} disabled={saving} size="lg" className="h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar alterações"}
        </Button>

        {isPrestador && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">Minhas categorias</h2>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Selecione os serviços que você oferece. Clientes filtram por essas categorias.
            </p>
            {catsQ.isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {(catsQ.data ?? []).map((c) => {
                  const active = selCats.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCat(c.id)}
                      className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 text-center text-xs font-medium transition ${
                        active ? "border-primary bg-secondary text-primary" : "border-border text-foreground"
                      }`}
                    >
                      <CategoriaIcon name={c.icone} className="h-5 w-5" />
                      <span className="line-clamp-2 leading-tight">{c.nome}</span>
                      {active && (
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <Button
              onClick={salvarCategorias}
              disabled={savingCats}
              size="lg"
              className="mt-4 h-12 w-full rounded-xl"
            >
              {savingCats ? <Loader2 className="h-5 w-5 animate-spin" /> : `Salvar categorias (${selCats.size})`}
            </Button>
          </div>
        )}

        <Button variant="outline" onClick={logout} size="lg" className="h-12 w-full rounded-xl">
          <LogOut className="h-5 w-5" /> Sair da conta
        </Button>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Notificações no celular</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Receba avisos de novas mensagens e propostas mesmo com o app em segundo plano.
            No iPhone, adicione o Weyze à tela inicial antes de ativar.
          </p>
          {notifPerm === "granted" ? (
            <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
              <Check className="h-4 w-4" /> Notificações ativadas
            </div>
          ) : notifPerm === "denied" ? (
            <p className="text-sm text-destructive">
              Notificações bloqueadas. Libere nas configurações do navegador.
            </p>
          ) : (
            <Button onClick={ativarNotificacoes} size="lg" className="h-12 w-full rounded-xl">
              <Bell className="h-5 w-5" /> Ativar notificações
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}