import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { fetchCategorias, fetchPrestadoresPorCategoria } from "@/lib/data";
import { PrestadorCardItem } from "@/components/prestador-card";

export const Route = createFileRoute("/_authenticated/app/categoria/$id")({
  component: CategoriaPage,
});

function CategoriaPage() {
  const { id } = Route.useParams();
  const cats = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });
  const cat = cats.data?.find((c) => c.id === id);
  const list = useQuery({
    queryKey: ["prestadores", "categoria", id],
    queryFn: () => fetchPrestadoresPorCategoria(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
        <Link to="/app" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">{cat?.nome ?? "Categoria"}</h1>
      </header>
      <section className="space-y-3 px-6">
        {list.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />)
        ) : (list.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">Ninguém disponível ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Seja o primeiro a oferecer este serviço.</p>
          </div>
        ) : (
          list.data!.map((p) => <PrestadorCardItem key={p.id} p={p} />)
        )}
      </section>
    </div>
  );
}