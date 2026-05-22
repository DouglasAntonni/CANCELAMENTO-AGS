import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { TrendingUp, AlertCircle, DollarSign, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { RequireAuth } from "@/auth/RequireAuth";
import { STATUS_OPTIONS, type CancelStatus } from "@/lib/status";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Cancelamentos" },
      {
        name: "description",
        content: "Visão geral dos cancelamentos: totais, multa e tendências.",
      },
    ],
  }),
  component: () => (
    <RequireAuth roles={["admin", "total", "supervisor", "consultor"]}>
      <Dashboard />
    </RequireAuth>
  ),
});

type Row = {
  id: string;
  created_at: string;
  operadora: string | null;
  supervisor: string | null;
  nome_cliente: string;
  cancelar_com_multa: boolean | null;
  valor_maximo_multa: number | null;
  status: CancelStatus | null;
};

function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("cancelamentos")
          .select(
            "id,created_at,operadora,supervisor,nome_cliente,cancelar_com_multa,valor_maximo_multa,status",
          )
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (data) setRows(data as Row[]);
      } catch (e) {
        toast.error("Falha ao carregar dashboard", {
          description: e instanceof Error ? e.message : "Erro desconhecido",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const week = Date.now() - 7 * 86_400_000;
    const total = rows.length;
    const todayCount = rows.filter((r) => new Date(r.created_at).toDateString() === today).length;
    const weekCount = rows.filter((r) => new Date(r.created_at).getTime() >= week).length;
    const comMulta = rows.filter((r) => r.cancelar_com_multa).length;
    const valorTotal = rows.reduce((s, r) => s + (Number(r.valor_maximo_multa) || 0), 0);
    return { total, todayCount, weekCount, comMulta, valorTotal };
  }, [rows]);

  const byOperadora = useMemo(() => groupCount(rows, (r) => r.operadora), [rows]);
  const bySupervisor = useMemo(() => groupCount(rows, (r) => r.supervisor), [rows]);
  const byStatus = useMemo(
    () =>
      STATUS_OPTIONS.map(
        (o) =>
          [o.label, rows.filter((r) => (r.status ?? "pendente") === o.value).length] as [
            string,
            number,
          ],
      ).filter(([, n]) => n > 0),
    [rows],
  );

  const cards = [
    {
      label: "Total",
      value: stats.total,
      hint: `${stats.weekCount} nos últimos 7 dias`,
      icon: TrendingUp,
      tone: "primary",
    },
    {
      label: "Hoje",
      value: stats.todayCount,
      hint: "Cancelamentos registrados hoje",
      icon: Calendar,
      tone: "success",
    },
    {
      label: "Com multa",
      value: stats.comMulta,
      hint: `${pct(stats.comMulta, stats.total)} do total`,
      icon: AlertCircle,
      tone: "destructive",
    },
    {
      label: "Valor de multa",
      value: stats.valorTotal.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      hint: "Soma máx. autorizada",
      icon: DollarSign,
      tone: "accent",
    },
  ] as const;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Visão geral dos cancelamentos da operação.</p>
          </div>
          <Link
            to="/registros"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Ver todos registros <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {cards.map((c, i) => (
                <KpiCard key={c.label} {...c} delay={i * 50} />
              ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {STATUS_OPTIONS.map((o) => {
                const n = rows.filter((r) => (r.status ?? "pendente") === o.value).length;
                return (
                  <div
                    key={o.value}
                    className={`rounded-lg border p-3 flex items-center justify-between ${o.tone}`}
                  >
                    <span className="text-sm font-medium">{o.label}</span>
                    <span className="text-xl font-bold tabular-nums">{n}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <BarPanel title="Por operadora" items={byOperadora} />
              <BarPanel title="Por supervisor" items={bySupervisor} />
              <BarPanel title="Por status" items={byStatus} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  delay,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof TrendingUp;
  tone: "primary" | "success" | "destructive" | "accent";
  delay: number;
}) {
  const toneClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    accent: "bg-accent text-accent-foreground",
  };
  return (
    <div
      className="bg-card rounded-xl p-5 border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-shadow animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function BarPanel({ title, items }: { title: string; items: [string, number][] }) {
  const max = Math.max(1, ...items.map(([, n]) => n));
  return (
    <section className="bg-card rounded-xl p-6 border border-border shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sem dados ainda.</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map(([label, count]) => (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground truncate pr-2">{label}</span>
                <span className="text-muted-foreground tabular-nums">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(count / max) * 100}%`,
                    background: "var(--gradient-hero)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function groupCount<T>(rows: T[], key: (r: T) => string | null): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? "Não informado";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function pct(a: number, b: number) {
  if (!b) return "0%";
  return `${Math.round((a / b) * 100)}%`;
}
