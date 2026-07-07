import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { WeyzeLogo } from "@/components/weyze-logo";
import { BRAND } from "@/lib/brand";

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [tab, setTab] = useState<"login" | "signup">(search.mode ?? "login");
  const [loading, setLoading] = useState(false);

  // Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup
  const [nome, setNome] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [tipo, setTipo] = useState<"cliente" | "prestador">("cliente");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/app" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: sEmail,
      password: sPassword,
      options: {
        emailRedirectTo: window.location.origin + "/app",
        data: { nome, tipo_usuario: tipo },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    setTab("login");
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (result.error) {
      setLoading(false);
      toast.error("Não foi possível entrar com Google.");
      return;
    }
    if (!result.redirected) navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen bg-secondary">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background px-6 pb-10 pt-10">
        <Link to="/" className="mb-8 flex items-center gap-3">
          <WeyzeLogo size={48} />
          <div>
            <p className="text-lg font-bold tracking-tight">{BRAND.name}</p>
            <p className="text-xs text-muted-foreground">{BRAND.tagline}</p>
          </div>
        </Link>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-full bg-secondary p-1">
            <TabsTrigger value="login" className="rounded-full">Entrar</TabsTrigger>
            <TabsTrigger value="signup" className="rounded-full">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-8 space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
              </div>
              <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-success text-base font-semibold text-success-foreground hover:bg-success/90">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-8 space-y-4">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semail">E-mail</Label>
                <Input id="semail" type="email" required value={sEmail} onChange={(e) => setSEmail(e.target.value)} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spassword">Senha</Label>
                <Input id="spassword" type="password" required minLength={6} value={sPassword} onChange={(e) => setSPassword(e.target.value)} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-3">
                <Label>Você quer</Label>
                <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as "cliente" | "prestador")} className="grid grid-cols-2 gap-3">
                  <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-4 text-center transition-colors ${tipo === "cliente" ? "border-primary bg-secondary" : "border-border"}`}>
                    <RadioGroupItem value="cliente" className="sr-only" />
                    <span className="font-semibold">Contratar</span>
                    <span className="text-xs text-muted-foreground">Sou cliente</span>
                  </label>
                  <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-4 text-center transition-colors ${tipo === "prestador" ? "border-primary bg-secondary" : "border-border"}`}>
                    <RadioGroupItem value="prestador" className="sr-only" />
                    <span className="font-semibold">Trabalhar</span>
                    <span className="text-xs text-muted-foreground">Sou prestador</span>
                  </label>
                </RadioGroup>
              </div>
              <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-success text-base font-semibold text-success-foreground hover:bg-success/90">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" onClick={handleGoogle} disabled={loading} className="h-12 w-full rounded-xl border-border text-base font-semibold">
          <GoogleIcon />
          Continuar com Google
        </Button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-5 w-5" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3c-2 1.4-4.6 2.3-7.4 2.3-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.5 39.5 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C41.3 35.5 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}