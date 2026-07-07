import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeyzeLogo } from "@/components/weyze-logo";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-secondary">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
        <header className="flex items-center justify-between px-6 pt-8">
          <div className="flex items-center gap-3">
            <WeyzeLogo size={44} />
            <span className="text-lg font-bold tracking-tight">{BRAND.name}</span>
          </div>
          <Link to="/auth" className="text-sm font-medium text-primary">Entrar</Link>
        </header>

        <section className="flex-1 px-6 pt-14">
          <h1 className="text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-foreground">
            Conectamos <span className="text-success">serviços</span>,
            <br />
            solucionamos <span className="text-primary">problemas</span>.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Encontre profissionais de confiança em segundos. Eletricistas, encanadores, faxineiras, pintores e muito mais — a um toque de distância.
          </p>

          <div className="mt-10 space-y-3">
            <Feature icon={Zap} title="Rápido" desc="Solicite em menos de 30 segundos." />
            <Feature icon={ShieldCheck} title="Confiável" desc="Profissionais avaliados e verificados." />
            <Feature icon={Sparkles} title="Inteligente" desc="Diga o que precisa. A gente encontra." />
          </div>
        </section>

        <footer className="sticky bottom-0 space-y-3 bg-gradient-to-t from-background via-background to-transparent px-6 pb-8 pt-6">
          <Button asChild size="lg" className="h-14 w-full rounded-2xl bg-success text-base font-semibold text-success-foreground shadow-soft hover:bg-success/90">
            <Link to="/auth" search={{ mode: "signup" }}>
              Começar agora <ArrowRight className="ml-1 h-5 w-5" />
            </Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/auth" className="font-medium text-primary">Entrar</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Zap; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
