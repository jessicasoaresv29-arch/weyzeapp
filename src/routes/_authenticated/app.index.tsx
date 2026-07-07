import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Bell, Star } from "lucide-react";

import { fetchCategorias, fetchTopPrestadores } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { WeyzeLogo } from "@/components/weyze-logo";
import { CategoriaIcon } from "@/components/categoria-icon";
import { PrestadorCardItem } from "@/components/prestador-card";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Home,
});

function Home() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const cats = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });
  const top = useQuery({ queryKey: ["prestadores", "top"], queryFn: () => fetchTopPrestadores(6) });

  const firstName = (profile?.nome ?? "").split(" ")[0] || "olá";

  return (
    <div className="flex flex-col gap-8">
      <header className="px-6 pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WeyzeLogo size={40} />
            <div>
              <p className="text-xs text-muted-foreground">Olá,</p>
              <p className="text-base font-semibold capitalize leading-tight">{firstName}</p>
            </div>
          </div>
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground">
            <Bell className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <button
          onClick={() => navigate({ to: "/app/buscar" })}
          className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-card transition-transform active:scale-[0.99]"
        >
          <Search className="h-5 w-5 text-primary" strokeWidth={2} />
          <span className="text-base text-muted-foreground">O que você precisa hoje?</span>
        </button>
      </header>

      <section className="px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Categorias</h2>
          <Link to="/app/buscar" className="text-sm font-medium text-primary">Ver todas</Link>
        </div>
        {cats.isLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {(cats.data ?? []).slice(0, 8).map((c) => (
              <Link
                key={c.id}
                to="/app/categoria/$id"
                params={{ id: c.id }}
                className="flex flex-col items-center gap-2 rounded-2xl bg-secondary p-3 text-center transition-transform active:scale-95"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card shadow-card">
                  <CategoriaIcon name={c.icone} className="h-5 w-5 text-primary" />
                </div>
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
                  {c.nome}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Mais bem avaliados</h2>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-current text-amber-400" strokeWidth={0} />
            Top
          </span>
        </div>
        {top.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : (top.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum prestador cadastrado ainda. Volte em breve.
          </p>
        ) : (
          <div className="space-y-3">
            {top.data!.map((p) => (
              <PrestadorCardItem key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}