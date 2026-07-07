import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";

import { fetchCategorias, searchPrestadores } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { CategoriaIcon } from "@/components/categoria-icon";
import { PrestadorCardItem } from "@/components/prestador-card";

export const Route = createFileRoute("/_authenticated/app/buscar")({
  component: Buscar,
});

function Buscar() {
  const [query, setQuery] = useState("");
  const cats = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });
  const results = useQuery({
    queryKey: ["buscar", query],
    queryFn: () => searchPrestadores(query),
    enabled: query.length > 1,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <Link to="/app" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar profissional, serviço, cidade..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 rounded-full border-border bg-secondary pl-11 pr-4"
          />
        </div>
      </header>

      {query.length <= 1 ? (
        <section className="px-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Todas as categorias
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(cats.data ?? []).map((c) => (
              <Link
                key={c.id}
                to="/app/categoria/$id"
                params={{ id: c.id }}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-card transition-transform active:scale-95"
              >
                <CategoriaIcon name={c.icone} className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium leading-tight">{c.nome}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-3 px-6">
          {results.isLoading ? (
            <p className="text-sm text-muted-foreground">Buscando...</p>
          ) : (results.data ?? []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum resultado para "{query}".
            </p>
          ) : (
            results.data!.map((p) => <PrestadorCardItem key={p.id} p={p} />)
          )}
        </section>
      )}
    </div>
  );
}