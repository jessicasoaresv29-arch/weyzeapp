import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, Inbox, User, MessageSquare, LayoutDashboard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type Item = { to: string; label: string; icon: typeof Home; exact?: boolean };
const clienteItems: Item[] = [
  { to: "/app", label: "Início", icon: Home, exact: true },
  { to: "/app/buscar", label: "Buscar", icon: Search },
  { to: "/app/solicitacoes", label: "Pedidos", icon: Inbox },
  { to: "/app/chat", label: "Chat", icon: MessageSquare },
  { to: "/app/perfil", label: "Perfil", icon: User },
];
const prestadorItems: Item[] = [
  { to: "/app/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/app/carteira", label: "Carteira", icon: Wallet },
  { to: "/app/chat", label: "Chat", icon: MessageSquare },
  { to: "/app/perfil", label: "Perfil", icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const { profile } = useAuth();
  const items = profile?.tipo_usuario === "prestador" ? prestadorItems : clienteItems;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {items.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to as never}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-6 w-6", active && "stroke-[2.5]")} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}