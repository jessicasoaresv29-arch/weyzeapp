import { createFileRoute } from "@tanstack/react-router";

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/admin/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = request.headers.get("x-admin-token");
        const expected = process.env.ADMIN_API_TOKEN;
        if (!expected || token !== expected) return unauthorized();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: payments, error } = await (supabaseAdmin as any)
          .from("payments")
          .select("id, status, forma, valor_bruto, taxa_valor, valor_liquido, created_at, paid_at, contrato_id, cliente_id, prestador_id, mp_payment_id")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const list = payments ?? [];
        const concluidos = list.filter((p: any) => p.status === "concluido");
        const online = concluidos.filter((p: any) => p.forma !== "dinheiro");
        const soma = (arr: any[], k: string) => arr.reduce((s, p) => s + Number(p[k] ?? 0), 0);

        return Response.json({
          totals: {
            transactions: list.length,
            concluidos: concluidos.length,
            gmv_bruto: soma(concluidos, "valor_bruto"),
            gmv_online: soma(online, "valor_bruto"),
            taxa_weyze: soma(online, "taxa_valor"),
            repasse_prestadores: soma(online, "valor_liquido"),
          },
          por_status: list.reduce((acc: Record<string, number>, p: any) => {
            acc[p.status] = (acc[p.status] ?? 0) + 1;
            return acc;
          }, {}),
          por_forma: concluidos.reduce((acc: Record<string, number>, p: any) => {
            acc[p.forma] = (acc[p.forma] ?? 0) + Number(p.valor_bruto ?? 0);
            return acc;
          }, {}),
          recent: list.slice(0, 50),
        });
      },
    },
  },
});