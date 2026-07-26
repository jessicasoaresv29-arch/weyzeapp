import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface WeyzeProfile {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  tipo_usuario: "cliente" | "prestador";
  cidade: string | null;
  estado: string | null;
  descricao: string | null;
  verificado: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<WeyzeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async (u: User | null) => {
      if (!mounted) return;
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id,nome,telefone,foto_url,tipo_usuario,cidade,estado,descricao,verificado")
        .eq("id", u.id)
        .maybeSingle();
      if (mounted) {
        setProfile(data ? ({ ...data, email: u.email ?? null } as WeyzeProfile) : null);
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}