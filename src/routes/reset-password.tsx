import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { WeyzeLogo } from "@/components/weyze-logo";

export const Route = createFileRoute("/reset-password")({
  component: Reset,
});

function Reset() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    navigate({ to: "/app" });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <WeyzeLogo size={64} />
      <h1 className="mt-4 text-2xl font-bold">Nova senha</h1>
      <form onSubmit={submit} className="mt-8 w-full space-y-4">
        <div className="space-y-2">
          <Label htmlFor="np">Senha</Label>
          <Input id="np" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-success text-success-foreground hover:bg-success/90">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar"}
        </Button>
      </form>
    </div>
  );
}