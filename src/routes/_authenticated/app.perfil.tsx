import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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

        <Button variant="outline" onClick={logout} size="lg" className="h-12 w-full rounded-xl">
          <LogOut className="h-5 w-5" /> Sair da conta
        </Button>
      </section>
    </div>
  );
}