import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useDeferredValue, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncCancelamentoToSheet } from "@/server/sheets.functions";
import { SHEET_URL } from "@/lib/sheet";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Download,
  FileText,
  ExternalLink,
  Filter,
  X,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sheet as SheetIcon,
} from "lucide-react";
// XLSX imported dynamically
import { OPERADORAS, SUPERVISORES } from "@/lib/constants";
import { RequireAuth } from "@/auth/RequireAuth";
import { StatusDropdown } from "@/components/StatusDropdown";
import { STATUS_OPTIONS, type CancelStatus } from "@/lib/status";
import { FaturaLinkButton } from "@/components/FaturaLinkButton";

export const Route = createFileRoute("/registros")({
  head: () => ({
    meta: [
      { title: "Registros | Cancelamentos" },
      { name: "description", content: "Lista, filtros e exportação dos cancelamentos." },
    ],
  }),
  component: () => (
    <RequireAuth roles={["admin", "total", "consultor"]}>
      <Registros />
    </RequireAuth>
  ),
});

type Cancelamento = {
  id: string;
  created_at: string;
  operadora: string | null;
  supervisor: string | null;
  nome_cliente: string;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  numero_contrato: string | null;
  contato_1: string | null;
  forma_pagamento: string | null;
  banco: string | null;
  cancelar_com_multa: boolean | null;
  valor_maximo_multa: number | null;
  fatura_url: string | null;
  sheet_synced: boolean | null;
  sheet_synced_at: string | null;
  sheet_error: string | null;
  status: CancelStatus | null;
};

type SortKey = "newest" | "oldest" | "name" | "valor_desc";
type MultaFilter = "all" | "yes" | "no";
type Period = "all" | "today" | "7d" | "30d";
type SyncFilter = "all" | "synced" | "pending";
type StatusFilter = "all" | CancelStatus;

function Registros() {
  const [rows, setRows] = useState<Cancelamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [operadora, setOperadora] = useState("all");
  const [supervisor, setSupervisor] = useState("all");
  const [multa, setMulta] = useState<MultaFilter>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [sync, setSync] = useState<SyncFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    setPage(1);
  }, [q, operadora, supervisor, multa, period, sync, statusFilter, sort]);
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isList = pathname === "/registros" || pathname === "/registros/";

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cancelamentos")
        .select(
          "id,created_at,operadora,supervisor,nome_cliente,cpf,cnpj,email,numero_contrato,contato_1,forma_pagamento,banco,cancelar_com_multa,valor_maximo_multa,fatura_url,sheet_synced,sheet_synced_at,sheet_error,status",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setRows(data as Cancelamento[]);
    } catch (e) {
      toast.error("Falha ao carregar registros", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const retrySync = useCallback(async (id: string) => {
    setRetrying((r) => ({ ...r, [id]: true }));
    try {
      const res = await syncCancelamentoToSheet({ data: { id } });
      if (res.ok) {
        toast.success("Sincronizado com a planilha");
        setRows((rs) =>
          rs.map((r) =>
            r.id === id
              ? {
                  ...r,
                  sheet_synced: true,
                  sheet_synced_at: new Date().toISOString(),
                  sheet_error: null,
                }
              : r,
          ),
        );
      } else {
        toast.error("Falha ao sincronizar", { description: res.error });
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, sheet_error: res.error } : r)));
      }
    } catch (e) {
      toast.error("Erro inesperado", {
        description: e instanceof Error ? e.message : "desconhecido",
      });
    } finally {
      setRetrying((r) => ({ ...r, [id]: false }));
    }
  }, []);

  const deferredQ = useDeferredValue(q);

  const filtered = useMemo(() => {
    const s = deferredQ.trim().toLowerCase();
    const now = Date.now();
    const cutoff =
      period === "today"
        ? new Date().setHours(0, 0, 0, 0)
        : period === "7d"
          ? now - 7 * 86_400_000
          : period === "30d"
            ? now - 30 * 86_400_000
            : 0;

    let r = rows.filter((row) => {
      if (operadora !== "all" && row.operadora !== operadora) return false;
      if (supervisor !== "all" && row.supervisor !== supervisor) return false;
      if (multa === "yes" && !row.cancelar_com_multa) return false;
      if (multa === "no" && row.cancelar_com_multa) return false;
      if (sync === "synced" && !row.sheet_synced) return false;
      if (sync === "pending" && row.sheet_synced) return false;
      if (statusFilter !== "all" && (row.status ?? "pendente") !== statusFilter) return false;
      if (cutoff && new Date(row.created_at).getTime() < cutoff) return false;
      if (s) {
        const haystack = [
          row.nome_cliente,
          row.cpf,
          row.cnpj,
          row.numero_contrato,
          row.email,
          row.operadora,
          row.supervisor,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });

    r = [...r].sort((a, b) => {
      if (sort === "newest")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === "name") return a.nome_cliente.localeCompare(b.nome_cliente);
      return (Number(b.valor_maximo_multa) || 0) - (Number(a.valor_maximo_multa) || 0);
    });

    return r;
  }, [rows, deferredQ, operadora, supervisor, multa, period, sync, statusFilter, sort]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const activeFilters =
    (operadora !== "all" ? 1 : 0) +
    (supervisor !== "all" ? 1 : 0) +
    (multa !== "all" ? 1 : 0) +
    (period !== "all" ? 1 : 0) +
    (sync !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  const pendingCount = rows.filter((r) => !r.sheet_synced).length;

  function clearFilters() {
    setOperadora("all");
    setSupervisor("all");
    setMulta("all");
    setPeriod("all");
    setSync("all");
    setStatusFilter("all");
    setQ("");
  }

  async function exportXlsx() {
    try {
      const XLSX = await import("xlsx");
      const data = filtered.map((r) => ({
        "Data registro": new Date(r.created_at).toLocaleString("pt-BR"),
        Operadora: r.operadora,
        Supervisor: r.supervisor,
        "Nome do cliente": r.nome_cliente,
        CPF: r.cpf,
        CNPJ: r.cnpj,
        Email: r.email,
        "Contato 1": r.contato_1,
        "Forma de pagamento": r.forma_pagamento,
        Banco: r.banco,
        "Nº contrato": r.numero_contrato,
        "Cancelar com multa": r.cancelar_com_multa ? "Sim" : "Não",
        "Valor máx. multa": r.valor_maximo_multa,
        Fatura: r.fatura_url,
        Status: r.status ?? "pendente",
        "Sync planilha": r.sheet_synced ? "Sim" : "Não",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cancelamentos");
      XLSX.writeFile(wb, `cancelamentos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast.error("Falha ao exportar excel", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    }
  }

  const handleStatusChange = useCallback((id: string, next: CancelStatus) => {
    setRows((rs) => rs.map((x) => (x.id === id ? { ...x, status: next } : x)));
  }, []);

  const handleRetrySync = useCallback((id: string) => {
    retrySync(id);
  }, [retrySync]);

  const isDetailModal = pathname.match(/^\/registros\/[a-zA-Z0-9-]+$/);

  if (!isList && !isDetailModal) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registros</h1>
            <p className="text-muted-foreground mt-1">
              {loading ? "Carregando..." : `${filtered.length} de ${rows.length} cancelamento(s)`}
              {pendingCount > 0 && !loading && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                  · {pendingCount} pendente(s) na planilha
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={SHEET_URL} target="_blank" rel="noreferrer">
                <SheetIcon className="h-4 w-4" /> Abrir planilha
              </a>
            </Button>
            <Button onClick={exportXlsx} disabled={!filtered.length}>
              <Download className="h-4 w-4" /> Exportar Excel
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-[var(--shadow-card)] mb-6 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, CPF, CNPJ, contrato..."
                className="pl-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters((v) => !v)}
              className="relative"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilters > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2 border-t border-border animate-in fade-in slide-in-from-top-1">
              <FilterSelect
                label="Operadora"
                value={operadora}
                onChange={setOperadora}
                options={[["all", "Todas"], ...OPERADORAS.map((o) => [o, o] as [string, string])]}
              />
              <FilterSelect
                label="Supervisor"
                value={supervisor}
                onChange={setSupervisor}
                options={[["all", "Todos"], ...SUPERVISORES.map((o) => [o, o] as [string, string])]}
              />
              <FilterSelect
                label="Multa"
                value={multa}
                onChange={(v) => setMulta(v as MultaFilter)}
                options={[
                  ["all", "Todas"],
                  ["yes", "Com multa"],
                  ["no", "Sem multa"],
                ]}
              />
              <FilterSelect
                label="Período"
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                options={[
                  ["all", "Sempre"],
                  ["today", "Hoje"],
                  ["7d", "7 dias"],
                  ["30d", "30 dias"],
                ]}
              />
              <FilterSelect
                label="Planilha"
                value={sync}
                onChange={(v) => setSync(v as SyncFilter)}
                options={[
                  ["all", "Todos"],
                  ["synced", "Sincronizados"],
                  ["pending", "Pendentes"],
                ]}
              />
              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                options={[
                  ["all", "Todos"],
                  ...STATUS_OPTIONS.map((o) => [o.value, o.label] as [string, string]),
                ]}
              />
              <FilterSelect
                label={
                  <span className="inline-flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" /> Ordenar
                  </span>
                }
                value={sort}
                onChange={(v) => setSort(v as SortKey)}
                options={[
                  ["newest", "Mais recentes"],
                  ["oldest", "Mais antigos"],
                  ["name", "Nome A-Z"],
                  ["valor_desc", "Maior multa"],
                ]}
              />
              {(activeFilters > 0 || q) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="col-span-2 md:col-span-6 inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" /> Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-xl border border-border">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum registro encontrado.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {paginated.map((r, i) => (
              <RegistroRow
                key={r.id}
                r={r}
                index={i}
                retrying={!!retrying[r.id]}
                onStatusChange={handleStatusChange}
                onRetrySync={handleRetrySync}
              />
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 bg-card rounded-xl border border-border p-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground font-medium">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
      <Outlet />
    </div>
  );
}

const FilterSelect = memo(function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="space-y-1 block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-surface px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
});

const RegistroRow = memo(function RegistroRow({
  r,
  index,
  retrying,
  onStatusChange,
  onRetrySync,
}: {
  r: Cancelamento;
  index: number;
  retrying: boolean;
  onStatusChange: (id: string, status: CancelStatus) => void;
  onRetrySync: (id: string) => void;
}) {
  return (
    <div
      className="block bg-card rounded-xl border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:border-primary/30 transition-all animate-in fade-in slide-in-from-bottom-1"
      style={{
        animationDelay: `${Math.min(index, 10) * 30}ms`,
        animationFillMode: "backwards",
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link to="/registros/$id" params={{ id: r.id }} className="hover:underline">
            <h3 className="font-semibold text-foreground text-lg truncate">
              {r.nome_cliente}
            </h3>
          </Link>
          <p className="text-sm text-muted-foreground mt-0.5">
            {r.operadora ?? "—"} · {r.supervisor ?? "Sem supervisor"} ·{" "}
            {new Date(r.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusDropdown
            id={r.id}
            value={r.status ?? "pendente"}
            size="sm"
            onChange={(next) => onStatusChange(r.id, next)}
          />
          {r.sheet_synced ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              title={
                r.sheet_synced_at
                  ? `Sincronizado em ${new Date(r.sheet_synced_at).toLocaleString("pt-BR")}`
                  : "Sincronizado"
              }
            >
              <CheckCircle2 className="h-3 w-3" /> Planilha
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400"
              title={r.sheet_error ?? "Aguardando sincronização"}
            >
              <AlertCircle className="h-3 w-3" /> Pendente
            </span>
          )}
          {r.cancelar_com_multa && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
              Multa
              {r.valor_maximo_multa
                ? ` · ${Number(r.valor_maximo_multa).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                : ""}
            </span>
          )}
          {r.fatura_url && <FaturaLinkButton value={r.fatura_url} />}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          ["CPF", r.cpf],
          ["CNPJ", r.cnpj],
          ["Contrato", r.numero_contrato],
          ["Contato", r.contato_1],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k as string} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {k}
              </dt>
              <dd className="text-foreground truncate">{v}</dd>
            </div>
          ))}
      </dl>
      <div className="mt-4">
        <Link to="/registros/$id" params={{ id: r.id }} className="text-sm font-medium text-primary hover:underline">
          Ver detalhes do cancelamento &rarr;
        </Link>
      </div>
      {!r.sheet_synced && (
        <div className="mt-4 pt-4 border-t border-border flex items-start justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted-foreground min-w-0 flex-1">
            {r.sheet_error ? (
              <span className="text-destructive">⚠ {r.sheet_error}</span>
            ) : (
              "Ainda não enviado para a planilha."
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={retrying}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRetrySync(r.id);
            }}
          >
            {retrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Re-sincronizar
          </Button>
        </div>
      )}
    </div>
  );
});
