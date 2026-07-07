import { Link } from "@tanstack/react-router";
import { Star, MapPin } from "lucide-react";
import type { PrestadorCard } from "@/lib/data";

export function PrestadorCardItem({ p }: { p: PrestadorCard }) {
  const initial = p.nome?.[0]?.toUpperCase() ?? "?";
  return (
    <Link
      to="/app/prestador/$id"
      params={{ id: p.id }}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-transform active:scale-[0.98]"
    >
      <div className="relative">
        {p.foto_url ? (
          <img src={p.foto_url} alt={p.nome} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-lg font-bold text-white">
            {initial}
          </div>
        )}
        {p.disponivel && (
          <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card bg-online" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-semibold text-foreground">{p.nome || "Prestador"}</p>
          <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
            <Star className="h-4 w-4 fill-current text-amber-400" strokeWidth={0} />
            {p.nota_media.toFixed(1)}
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {p.categorias[0]?.nome ?? "Prestador"}
          {p.quantidade_avaliacoes > 0 && ` · ${p.quantidade_avaliacoes} avaliações`}
        </p>
        {p.cidade && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {p.cidade}
            {p.estado ? `, ${p.estado}` : ""}
          </p>
        )}
      </div>
    </Link>
  );
}