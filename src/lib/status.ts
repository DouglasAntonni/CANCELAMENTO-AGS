export type CancelStatus =
  | "pendente"
  | "em_andamento"
  | "aguardando_cliente"
  | "concluido"
  | "cancelado"
  | "falhou";

export const STATUS_OPTIONS: { value: CancelStatus; label: string; tone: string }[] = [
  {
    value: "pendente",
    label: "Pendente",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  {
    value: "em_andamento",
    label: "Em andamento",
    tone: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  {
    value: "aguardando_cliente",
    label: "Aguardando cliente",
    tone: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  {
    value: "concluido",
    label: "Concluído",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  {
    value: "cancelado",
    label: "Cancelado",
    tone: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30",
  },
  {
    value: "falhou",
    label: "Falhou",
    tone: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  },
];

export function statusMeta(s: CancelStatus | string | null | undefined) {
  return (
    STATUS_OPTIONS.find((o) => o.value === s) ?? {
      value: "pendente" as CancelStatus,
      label: "Pendente",
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    }
  );
}

// Estados terminais — não permitem mais alterações
export const TERMINAL_STATUSES: CancelStatus[] = ["concluido", "falhou"];

// Transições válidas entre status
export const STATUS_TRANSITIONS: Record<CancelStatus, CancelStatus[]> = {
  pendente: ["em_andamento", "aguardando_cliente", "cancelado", "falhou"],
  em_andamento: ["aguardando_cliente", "concluido", "cancelado", "falhou"],
  aguardando_cliente: ["em_andamento", "concluido", "cancelado", "falhou"],
  cancelado: ["pendente", "em_andamento"],
  concluido: [],
  falhou: [],
};

export function isTerminal(s: CancelStatus | string | null | undefined): boolean {
  return TERMINAL_STATUSES.includes(s as CancelStatus);
}

export function canTransition(
  from: CancelStatus | string | null | undefined,
  to: CancelStatus,
): { ok: boolean; reason?: string } {
  const current = (from ?? "pendente") as CancelStatus;
  if (current === to) return { ok: false, reason: "O status já está definido como esse." };
  if (isTerminal(current)) {
    return {
      ok: false,
      reason: `Status "${statusMeta(current).label}" é final e não pode ser alterado.`,
    };
  }
  const allowed = STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Transição inválida: "${statusMeta(current).label}" → "${statusMeta(to).label}".`,
    };
  }
  return { ok: true };
}
