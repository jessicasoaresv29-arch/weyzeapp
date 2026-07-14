// Utilitário de notificações do navegador (funciona em desktop e Android
// quando o app está instalado como PWA). No iOS só funciona quando o usuário
// adiciona o app à tela inicial (Safari 16.4+).

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showBrowserNotification(
  title: string,
  options: NotificationOptions & { onClickUrl?: string } = {},
) {
  if (!notificationsSupported()) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    // Se a aba está visível, evita notificação nativa duplicada.
    // O Toaster do app já mostra o feedback.
  }
  try {
    const { onClickUrl, ...rest } = options;
    const n = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...rest,
    });
    n.onclick = () => {
      window.focus();
      if (onClickUrl) window.location.assign(onClickUrl);
      n.close();
    };
  } catch {
    /* alguns navegadores exigem SW para Notification em contexto de background */
  }
}