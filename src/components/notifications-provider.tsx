import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  notificationsSupported,
  requestNotificationPermission,
  showBrowserNotification,
} from "@/lib/notifications";

type Notif = {
  id: string;
  usuario_id: string;
  titulo: string;
  mensagem: string | null;
  tipo: string | null;
  link: string | null;
};

export function NotificationsProvider() {
  const { user } = useAuth();
  const location = useLocation();

  // Pede permissão silenciosamente uma vez (usuário pode aprovar via clique no botão do Perfil se rejeitar aqui).
  useEffect(() => {
    if (!user) return;
    if (!notificationsSupported()) return;
    if (Notification.permission === "default") {
      // Fire-and-forget; alguns navegadores ignoram sem gesto do usuário — o botão do Perfil cobre esse caso.
      requestNotificationPermission().catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `usuario_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notif;
          // Se o usuário já está exatamente na página do link, não notifica.
          if (n.link && location.pathname === n.link) return;

          // Toast in-app
          toast(n.titulo, { description: n.mensagem ?? undefined });

          // Notificação nativa (útil quando o app está em segundo plano no celular como PWA)
          showBrowserNotification(n.titulo, {
            body: n.mensagem ?? undefined,
            tag: n.tipo ?? "weyze",
            onClickUrl: n.link ?? "/app",
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname]);

  return null;
}