import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncCancelamentoToSheet } from "@/server/sheets.functions";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, X, Link2 } from "lucide-react";
import {
  SUPERVISORES,
  OPERADORAS,
  FORMAS_PAGAMENTO,
  maskCPF,
  maskCNPJ,
  maskPhone,
  maskMoney,
  parseMoney,
} from "@/lib/constants";
import { RequireAuth } from "@/auth/RequireAuth";
import { useAuth } from "@/auth/AuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Novo Cancelamento | Operação" },
      {
        name: "description",
        content: "Registre cancelamentos de operação com dados do cliente, contrato e fatura.",
      },
    ],
  }),
  component: () => (
    <RequireAuth roles={["admin", "total", "supervisor", "consultor"]}>
      <CancelamentoForm />
    </RequireAuth>
  ),
});

type Field = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  full?: boolean;
  options?: string[];
  mask?: "cpf" | "cnpj" | "phone";
};

const sections: { title: string; fields: Field[] }[] = [
  {
    title: "Operação",
    fields: [
      {
        name: "operadora",
        label: "Operadora para cancelamento",
        required: true,
        options: OPERADORAS,
      },
      { name: "supervisor", label: "Supervisor(a)", options: SUPERVISORES },
    ],
  },
  {
    title: "Dados do Cliente",
    fields: [
      { name: "nome_cliente", label: "Nome do cliente", required: true, full: true },
      { name: "cpf", label: "CPF", mask: "cpf", placeholder: "000.000.000-00" },
      { name: "cnpj", label: "CNPJ", mask: "cnpj", placeholder: "00.000.000/0000-00" },
      { name: "email", label: "E-mail", type: "email", placeholder: "cliente@exemplo.com" },
      { name: "nome_mae", label: "Nome da mãe" },
      { name: "data_nascimento", label: "Data de nascimento", type: "date" },
    ],
  },
  {
    title: "Endereço & Contatos",
    fields: [
      { name: "endereco_completo", label: "Endereço completo", full: true },
      { name: "ponto_referencia", label: "Ponto de referência", full: true },
      {
        name: "contato_1",
        label: "1º número de contato",
        mask: "phone",
        placeholder: "(00) 00000-0000",
      },
      {
        name: "contato_2",
        label: "2º número de contato",
        mask: "phone",
        placeholder: "(00) 00000-0000",
      },
      { name: "fixo", label: "Fixo", mask: "phone", placeholder: "(00) 0000-0000" },
    ],
  },
  {
    title: "Pagamento",
    fields: [
      { name: "forma_pagamento", label: "Forma de pagamento", options: FORMAS_PAGAMENTO },
      { name: "banco", label: "Banco" },
      { name: "agencia", label: "Agência" },
      { name: "conta", label: "Conta" },
      { name: "queima", label: "Queima" },
    ],
  },
  {
    title: "Contrato",
    fields: [{ name: "numero_contrato", label: "Número do contrato", full: true }],
  },
];

function applyMask(mask: Field["mask"], value: string) {
  if (mask === "cpf") return maskCPF(value);
  if (mask === "cnpj") return maskCNPJ(value);
  if (mask === "phone") return maskPhone(value);
  return value;
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const MAX_FATURA_BYTES = 10 * 1024 * 1024; // 10MB

type FaturaMode = "upload" | "link";

function CancelamentoForm() {
  const navigate = useNavigate();
  const { profile, hasAnyRole } = useAuth();
  const isOperator = hasAnyRole(["consultor", "supervisor"]) && !hasAnyRole(["admin", "total"]);
  const lockedSupervisor = isOperator ? (profile?.display_name ?? "") : "";
  const [submitting, setSubmitting] = useState(false);
  const [comMulta, setComMulta] = useState(false);
  const [valorMulta, setValorMulta] = useState("");
  const [faturaMode, setFaturaMode] = useState<FaturaMode>("upload");
  const [fatura, setFatura] = useState<File | null>(null);
  const [faturaLink, setFaturaLink] = useState("");
  const [faturaError, setFaturaError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  function setField(name: string, value: string) {
    setValues((p) => ({ ...p, [name]: value }));
  }

  function onSelectFile(file: File | null) {
    setFaturaError(null);
    if (file && file.size > MAX_FATURA_BYTES) {
      setFaturaError("Arquivo acima de 10 MB.");
      return;
    }
    setFatura(file);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFaturaError(null);

    // valida link se for o modo escolhido e foi preenchido
    if (faturaMode === "link" && faturaLink.trim()) {
      if (!isValidHttpUrl(faturaLink.trim())) {
        setFaturaError("Link inválido. Use uma URL http(s):// completa.");
        toast.error("Link da fatura inválido");
        return;
      }
    }

    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const data: Record<string, unknown> = {};
      for (const s of sections) {
        for (const f of s.fields) {
          const v = ((fd.get(f.name) as string) ?? "").trim();
          if (v) data[f.name] = v;
        }
      }
      data.cancelar_com_multa = comMulta;
      if (comMulta) {
        const n = parseMoney(valorMulta);
        if (n != null) data.valor_maximo_multa = n;
      }

      // Fatura: upload OU link
      if (faturaMode === "upload" && fatura) {
        const ext = fatura.name.split(".").pop() ?? "bin";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("faturas")
          .upload(path, fatura, { upsert: false });
        if (upErr) throw new Error(`Falha no upload da fatura: ${upErr.message}`);
        // Bucket é privado: armazenamos apenas o path; URL assinada é
        // gerada sob demanda em registros.$id.tsx / registros.tsx.
        data.fatura_url = path;
      } else if (faturaMode === "link" && faturaLink.trim()) {
        data.fatura_url = faturaLink.trim();
      }

      const { data: inserted, error } = await supabase
        .from("cancelamentos")
        .insert(data as never)
        .select("id")
        .single();
      if (error) throw error;

      const newId = (inserted as { id: string }).id;

      // Sincroniza com Google Sheets (não bloqueia o sucesso)
      try {
        const sheetRes = await syncCancelamentoToSheet({ data: { id: newId } });
        if (!sheetRes.ok) {
          toast.warning("Salvo, mas planilha não atualizou", {
            description: `${sheetRes.error} Você pode tentar novamente em Registros.`,
            duration: 6000,
          });
        }
      } catch (sheetErr) {
        console.error("Sheets sync error", sheetErr);
        toast.warning("Salvo, mas planilha não atualizou", {
          description: "Use o botão 'Re-sincronizar' na lista de registros.",
        });
      }

      toast.success("Cancelamento registrado!", {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      setTimeout(() => navigate({ to: "/registros" }), 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Falha ao registrar", { description: msg });
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold tracking-wider uppercase mb-3">
            Cancelamento · Operação
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Novo registro</h1>
          <p className="mt-2 text-muted-foreground">
            Preencha os dados do cliente, contrato e anexe a fatura.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {sections.map((section, idx) => (
            <section
              key={section.title}
              className="bg-card rounded-xl p-6 shadow-[var(--shadow-card)] border border-border animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "backwards" }}
            >
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {section.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {section.fields.map((f) => (
                  <div
                    key={f.name}
                    className={f.full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}
                  >
                    <Label htmlFor={f.name}>
                      {f.label}
                      {f.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    {f.name === "endereco_completo" ? (
                      <Textarea id={f.name} name={f.name} rows={2} />
                    ) : f.options ? (
                      f.name === "supervisor" && lockedSupervisor ? (
                        <Input
                          id={f.name}
                          name={f.name}
                          value={lockedSupervisor}
                          readOnly
                          className="bg-muted"
                        />
                      ) : (
                        <select
                          id={f.name}
                          name={f.name}
                          required={f.required}
                          defaultValue=""
                          className="flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
                        >
                          <option value="" disabled>
                            Selecione...
                          </option>
                          {f.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )
                    ) : (
                      <Input
                        id={f.name}
                        name={f.name}
                        type={f.type ?? "text"}
                        required={f.required}
                        placeholder={f.placeholder}
                        value={values[f.name] ?? ""}
                        onChange={(e) => setField(f.name, applyMask(f.mask, e.target.value))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="bg-card rounded-xl p-6 shadow-[var(--shadow-card)] border border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Multa
            </h2>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Cancelar com multa?</Label>
                <div className="flex gap-3">
                  {[
                    { v: true, label: "Sim" },
                    { v: false, label: "Não" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setComMulta(opt.v)}
                      className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${
                        comMulta === opt.v
                          ? "bg-primary text-primary-foreground border-primary shadow-[var(--shadow-elegant)]"
                          : "bg-surface text-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {comMulta && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                  <Label htmlFor="valor_maximo_multa">Valor máximo da multa</Label>
                  <Input
                    id="valor_maximo_multa"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={valorMulta}
                    onChange={(e) => setValorMulta(maskMoney(e.target.value))}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="bg-card rounded-xl p-6 shadow-[var(--shadow-card)] border border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Fatura do cliente
            </h2>

            <div className="inline-flex rounded-lg border border-border bg-surface p-1 mb-4">
              {[
                { v: "upload" as const, label: "Upload de arquivo", icon: Upload },
                { v: "link" as const, label: "Link externo", icon: Link2 },
              ].map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => {
                    setFaturaMode(m.v);
                    setFaturaError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    faturaMode === m.v
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <m.icon className="h-3.5 w-3.5" /> {m.label}
                </button>
              ))}
            </div>

            {faturaMode === "upload" ? (
              fatura ? (
                <div className="flex items-center justify-between gap-3 border border-border rounded-lg p-3 bg-accent/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{fatura.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(fatura.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFatura(null)}
                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="fatura"
                  className="flex items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Clique para anexar PDF / imagem (até 10 MB)
                  </span>
                  <input
                    id="fatura"
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="fatura_link">URL da fatura</Label>
                <Input
                  id="fatura_link"
                  type="url"
                  placeholder="https://..."
                  value={faturaLink}
                  onChange={(e) => {
                    setFaturaLink(e.target.value);
                    setFaturaError(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Cole o link público (Drive, OneDrive, etc).
                </p>
              </div>
            )}

            {faturaError && <p className="text-sm text-destructive mt-2">{faturaError}</p>}
          </section>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" disabled={submitting} size="lg" className="min-w-44">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                </>
              ) : (
                "Registrar cancelamento"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
