import { createFileRoute } from "@tanstack/react-router";
import { Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { updateCancelamento } from "@/server/registros.functions";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
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
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/registros/$id/edit")({
  head: () => ({
    meta: [{ title: "Editar Cancelamento" }],
  }),
  component: () => (
    <RequireAuth roles={["admin", "total"]}>
      <EditCancelamentoForm />
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

function EditCancelamentoForm() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [comMulta, setComMulta] = useState(false);
  const [valorMulta, setValorMulta] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const updateRecord = useServerFn(updateCancelamento);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cancelamentos").select("*").eq("id", id).maybeSingle();

      if (!data) {
        setMissing(true);
      } else {
        const row = data as Record<string, any>;
        const newValues: Record<string, string> = {};
        for (const s of sections) {
          for (const f of s.fields) {
            newValues[f.name] = row[f.name] ?? "";
          }
        }
        setValues(newValues);
        setComMulta(row.cancelar_com_multa === true);
        if (row.valor_maximo_multa) {
          setValorMulta(
            Number(row.valor_maximo_multa).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          );
        }
      }
      setLoading(false);
    })();
  }, [id]);

  function setField(name: string, value: string) {
    setValues((p) => ({ ...p, [name]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const fd = new FormData(e.currentTarget);
      const data: Record<string, unknown> = {};
      for (const s of sections) {
        for (const f of s.fields) {
          const v = ((fd.get(f.name) as string) ?? "").trim();
          data[f.name] = v || null;
        }
      }

      data.cancelar_com_multa = comMulta;
      if (comMulta) {
        const n = parseMoney(valorMulta);
        data.valor_maximo_multa = n != null ? n : null;
      } else {
        data.valor_maximo_multa = null;
      }

      const res = await updateRecord({ data: { id, payload: data } });

      if (!res.ok) {
        throw new Error(res.error);
      }

      toast.success("Registro atualizado com sucesso!", {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      setTimeout(() => {
        router.navigate({ to: "/registros/$id", params: { id } });
      }, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Falha ao atualizar", { description: msg });
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
        </div>
      </div>
    );
  }

  if (missing) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="max-w-2xl mx-auto p-10 text-center">
          <h2 className="text-2xl font-bold">Registro não encontrado</h2>
          <Link to="/registros" className="text-primary hover:underline mt-4 inline-block">
            Voltar para a lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link
            to="/registros/$id"
            params={{ id }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold tracking-wider uppercase mb-3">
            Edição · Admin
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Editar registro</h1>
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
                      <Textarea
                        id={f.name}
                        name={f.name}
                        rows={2}
                        value={values[f.name] ?? ""}
                        onChange={(e) => setField(f.name, e.target.value)}
                      />
                    ) : f.options ? (
                      <select
                        id={f.name}
                        name={f.name}
                        required={f.required}
                        value={values[f.name] || ""}
                        onChange={(e) => setField(f.name, e.target.value)}
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

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => router.navigate({ to: "/registros/$id", params: { id } })}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} size="lg" className="min-w-44">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
