import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
  Outlet,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncCancelamentoToSheet } from "@/server/sheets.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  ExternalLink,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileDown,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
// jsPDF and autoTable imported dynamically
import { RequireAuth } from "@/auth/RequireAuth";
import { StatusDropdown } from "@/components/StatusDropdown";
import { statusMeta, type CancelStatus } from "@/lib/status";
import { FaturaLinkButton } from "@/components/FaturaLinkButton";
import { getFaturaSignedUrl } from "@/server/faturas.functions";
import { deleteCancelamento } from "@/server/registros.functions";
import { useAuth } from "@/auth/AuthContext";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
export const Route = createFileRoute("/registros/$id")({
  head: () => ({
    meta: [{ title: "Detalhe do cancelamento" }],
  }),
  component: () => (
    <RequireAuth roles={["admin", "total", "consultor"]}>
      <Detail />
    </RequireAuth>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const navigate = useNavigate();
    return (
      <Dialog defaultOpen onOpenChange={(o) => !o && navigate({ to: "/registros" })}>
        <DialogContent aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>Erro</DialogTitle>
          </VisuallyHidden>
          <DialogHeader>
            <DialogTitle>Erro</DialogTitle>
          </DialogHeader>
          <div className="p-6 text-center">
            <p className="text-destructive mb-4">{error.message}</p>
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="text-primary hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  },
  notFoundComponent: () => {
    const navigate = useNavigate();
    return (
      <Dialog defaultOpen onOpenChange={(o) => !o && navigate({ to: "/registros" })}>
        <DialogContent aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>Registro não encontrado</DialogTitle>
          </VisuallyHidden>
          <DialogHeader>
            <DialogTitle>Registro não encontrado</DialogTitle>
          </DialogHeader>
          <div className="p-6 text-center">
            <Link to="/registros" className="text-primary hover:underline mt-4 inline-block">
              Voltar para a lista
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    );
  },
});

type Row = Record<string, unknown> & {
  id: string;
  created_at: string;
  nome_cliente: string;
  cancelar_com_multa: boolean | null;
  valor_maximo_multa: number | null;
  fatura_url: string | null;
  sheet_synced: boolean | null;
  sheet_synced_at: string | null;
  sheet_error: string | null;
  status: CancelStatus | null;
};

type StatusEvent = {
  id: string;
  from_status: CancelStatus | null;
  to_status: CancelStatus;
  changed_by_name: string | null;
  note: string | null;
  created_at: string;
};

const groups: { title: string; fields: [string, string][] }[] = [
  {
    title: "Operação",
    fields: [
      ["operadora", "Operadora"],
      ["supervisor", "Supervisor(a)"],
      ["numero_contrato", "Nº contrato"],
    ],
  },
  {
    title: "Cliente",
    fields: [
      ["cpf", "CPF"],
      ["cnpj", "CNPJ"],
      ["email", "E-mail"],
      ["nome_mae", "Nome da mãe"],
      ["data_nascimento", "Data de nascimento"],
    ],
  },
  {
    title: "Endereço & Contatos",
    fields: [
      ["endereco_completo", "Endereço"],
      ["ponto_referencia", "Ponto de referência"],
      ["contato_1", "Contato 1"],
      ["contato_2", "Contato 2"],
      ["fixo", "Fixo"],
    ],
  },
  {
    title: "Pagamento",
    fields: [
      ["forma_pagamento", "Forma de pagamento"],
      ["banco", "Banco"],
      ["agencia", "Agência"],
      ["conta", "Conta"],
      ["queima", "Queima"],
    ],
  },
];

function formatValue(k: string, v: unknown): string {
  if (v == null || v === "") return "—";
  if (k === "valor_maximo_multa")
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (k === "data_nascimento") {
    try {
      return new Date(String(v)).toLocaleDateString("pt-BR", { timeZone: "UTC" });
    } catch {
      return String(v);
    }
  }
  return String(v);
}

async function generatePdf(row: Row, invoiceUrl?: string | null) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Cabeçalho
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Cancelamento", margin, 32);
  doc.setFontSize(11);
  doc.setTextColor(200, 210, 225);
  doc.text(`Registrado em ${new Date(row.created_at).toLocaleString("pt-BR")}`, margin, 52);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.text(row.nome_cliente, margin, 100);

  // Badge de status
  const stMeta = statusMeta(row.status as CancelStatus | null);
  doc.setFillColor(241, 245, 249);
  doc.setTextColor(30, 41, 59);
  const stTxt = `Status: ${stMeta.label}`;
  const stW = doc.getTextWidth(stTxt) + 16;
  doc.roundedRect(pageWidth - margin - stW, 86, stW, 20, 4, 4, "F");
  doc.setFontSize(10);
  doc.text(stTxt, pageWidth - margin - stW + 8, 100);

  let cursorY = 115;

  if (row.cancelar_com_multa) {
    doc.setFillColor(254, 226, 226);
    doc.setTextColor(153, 27, 27);
    const txt = `Com multa${
      row.valor_maximo_multa
        ? " · " +
          Number(row.valor_maximo_multa).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })
        : ""
    }`;
    const w = doc.getTextWidth(txt) + 16;
    doc.roundedRect(margin, cursorY, w, 20, 4, 4, "F");
    doc.setFontSize(10);
    doc.text(txt, margin + 8, cursorY + 14);
    cursorY += 30;
  }
  doc.setTextColor(15, 23, 42);

  // Tabelas por seção
  for (const g of groups) {
    const body = g.fields
      .map(([k, label]) => {
        const v = row[k];
        if (v == null || v === "") return null;
        return [label, formatValue(k, v)];
      })
      .filter((x): x is string[] => x !== null);

    if (!body.length) continue;

    autoTable(doc, {
      startY: cursorY + 10,
      head: [[g.title, ""]],
      body,
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        fontSize: 11,
      },
      bodyStyles: { fontSize: 10, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 160, fontStyle: "bold", textColor: [71, 85, 105] },
        1: { cellWidth: "auto" },
      },
    });

    type DocWithAT = InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } };
    cursorY = (doc as DocWithAT).lastAutoTable?.finalY ?? cursorY + 30;
  }

  if (invoiceUrl) {
    cursorY += 16;
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Fatura:", margin, cursorY);
    doc.setTextColor(37, 99, 235);
    doc.textWithLink(invoiceUrl, margin + 40, cursorY, { url: invoiceUrl });
  }

  // Rodapé
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`ID ${row.id}`, margin, pageHeight - 20);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth - margin, pageHeight - 20, {
    align: "right",
  });

  const fname = `cancelamento-${row.nome_cliente.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${row.id.slice(0, 8)}.pdf`;
  doc.save(fname);
}

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<Row | null>(null);
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const resolveFatura = useServerFn(getFaturaSignedUrl);
  const deleteRecord = useServerFn(deleteCancelamento);
  const { hasAnyRole } = useAuth();
  const canAlter = hasAnyRole(["admin", "total"]);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDetail = pathname === `/registros/${id}` || pathname === `/registros/${id}/`;

  async function exportPdf() {
    if (!row) return;
    setExporting(true);
    try {
      let invoiceUrl: string | null = null;
      if (row.fatura_url) {
        try {
          const r = await resolveFatura({ data: { value: row.fatura_url } });
          invoiceUrl = r.url;
        } catch {
          invoiceUrl = null;
        }
      }
      await generatePdf(row, invoiceUrl);
    } finally {
      setExporting(false);
    }
  }

  async function loadHistory() {
    try {
      const { data, error } = await supabase
        .from("cancelamento_status_history")
        .select("id,from_status,to_status,changed_by_name,note,created_at")
        .eq("cancelamento_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setHistory(data as StatusEvent[]);
    } catch (e) {
      toast.error("Falha ao carregar histórico", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cancelamentos").select("*").eq("id", id).maybeSingle();
      if (!data) setMissing(true);
      else setRow(data as Row);
      setLoading(false);
      loadHistory();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function retry() {
    if (!row) return;
    setRetrying(true);
    try {
      const res = await syncCancelamentoToSheet({ data: { id: row.id } });
      if (res.ok) {
        toast.success("Sincronizado com a planilha");
        setRow({
          ...row,
          sheet_synced: true,
          sheet_synced_at: new Date().toISOString(),
          sheet_error: null,
        });
      } else {
        toast.error("Falha ao sincronizar", { description: res.error });
        setRow({ ...row, sheet_error: res.error });
      }
    } catch (e) {
      toast.error("Erro inesperado", {
        description: e instanceof Error ? e.message : "desconhecido",
      });
    } finally {
      setRetrying(false);
    }
  }

  async function handleDelete() {
    if (!row) return;
    if (
      !window.confirm(
        "Tem certeza que deseja excluir permanentemente este registro do sistema? (A exclusão não afeta a planilha do Google).",
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await deleteRecord({ data: { id: row.id } });
      if (res.ok) {
        toast.success("Registro excluído com sucesso!");
        navigate({ to: "/registros" });
      } else {
        toast.error("Falha ao excluir", { description: res.error });
      }
    } catch (e) {
      toast.error("Erro", { description: e instanceof Error ? e.message : "Desconhecido" });
    } finally {
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <Dialog open onOpenChange={(o) => !o && navigate({ to: "/registros" })}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>Carregando</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        </DialogContent>
      </Dialog>
    );

  if (missing || !row) throw notFound();

  if (!isDetail) {
    return <Outlet />;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && navigate({ to: "/registros" })}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border shadow-[var(--shadow-elegant)] [&>.absolute]:hidden" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Detalhes do Cancelamento: {row.nome_cliente}</DialogTitle>
        </VisuallyHidden>
        <DialogHeader className="p-6 pb-0 pt-8 sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight">{row.nome_cliente}</DialogTitle>
            <div className="flex items-center gap-2">
              {canAlter && (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/registros/$id/edit`} params={{ id }}>
                      <Pencil className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Editar</span>
                    </Link>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
                    ) : (
                      <Trash2 className="h-4 w-4 sm:mr-1.5" />
                    )}{" "}
                    <span className="hidden sm:inline">Excluir</span>
                  </Button>
                </>
              )}
              <Button onClick={exportPdf} variant="default" disabled={exporting} size="sm">
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
                ) : (
                  <FileDown className="h-4 w-4 sm:mr-1.5" />
                )}{" "}
                <span className="hidden sm:inline">Exportar</span>
              </Button>
              <DialogClose className="rounded-sm p-1.5 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </DialogClose>
            </div>
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(row.created_at).toLocaleString("pt-BR")}
          </div>
        </DialogHeader>

        <div className="p-6 pt-2">
          <div className="bg-muted/30 rounded-xl border border-border p-5 mb-6 shadow-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Status:
                </span>
                <StatusDropdown
                  id={row.id}
                  value={(row.status as CancelStatus | null) ?? "pendente"}
                  onChange={(next) => {
                    setRow({ ...row, status: next });
                    loadHistory();
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {row.sheet_synced ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Sincronizado
                    {row.sheet_synced_at &&
                      ` · ${new Date(row.sheet_synced_at).toLocaleString("pt-BR")}`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Pendente na planilha
                  </span>
                )}
                {row.cancelar_com_multa && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-destructive/10 text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Com multa
                    {row.valor_maximo_multa
                      ? ` · ${Number(row.valor_maximo_multa).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                      : ""}
                  </span>
                )}
                {row.fatura_url && (
                  <FaturaLinkButton
                    value={row.fatura_url}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    Abrir fatura <ExternalLink className="h-3.5 w-3.5" />
                  </FaturaLinkButton>
                )}
              </div>
            </div>

            {!row.sheet_synced && (
              <div className="mt-5 pt-5 border-t border-border flex items-start justify-between gap-3 flex-wrap">
                <div className="text-sm text-muted-foreground min-w-0 flex-1">
                  {row.sheet_error ? (
                    <span className="text-destructive">⚠ {row.sheet_error}</span>
                  ) : (
                    "Este registro ainda não foi enviado para a planilha do Google Sheets."
                  )}
                </div>
                <Button onClick={retry} disabled={retrying} size="sm" variant="outline">
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

          <div className="grid gap-6">
            {groups.map((g) => {
              const visible = g.fields.filter(([k]) => row[k]);
              if (!visible.length) return null;
              return (
                <section
                  key={g.title}
                  className="bg-card rounded-xl border border-border shadow-sm p-5"
                >
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {g.title}
                  </h2>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {visible.map(([k, label]) => (
                      <div key={k}>
                        <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="text-foreground mt-0.5 break-words text-sm">
                          {formatValue(k, row[k])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}

            {history.length > 0 && (
              <section className="bg-card rounded-xl border border-border shadow-sm p-5">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Histórico de status
                </h2>
                <ol className="relative border-l border-border ml-2 space-y-4">
                  {history.map((h) => {
                    const to = statusMeta(h.to_status);
                    const from = h.from_status ? statusMeta(h.from_status) : null;
                    return (
                      <li key={h.id} className="ml-4">
                        <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                        <div className="flex flex-wrap items-center gap-2">
                          {from && (
                            <>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] border ${from.tone}`}
                              >
                                {from.label}
                              </span>
                              <span className="text-muted-foreground text-[10px]">→</span>
                            </>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] border ${to.tone}`}>
                            {to.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleString("pt-BR")}
                          {h.changed_by_name ? ` · por ${h.changed_by_name}` : ""}
                        </p>
                        {h.note && <p className="mt-1 text-xs text-foreground">{h.note}</p>}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
