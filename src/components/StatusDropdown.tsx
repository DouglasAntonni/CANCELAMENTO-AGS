import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncCancelamentoToSheet } from "@/server/sheets.functions";
import { useAuth } from "@/auth/AuthContext";
import {
  STATUS_OPTIONS,
  statusMeta,
  canTransition,
  isTerminal,
  type CancelStatus,
} from "@/lib/status";
import { Loader2, ChevronDown, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  value: CancelStatus | string | null;
  onChange?: (next: CancelStatus) => void;
  size?: "sm" | "md";
  resync?: boolean;
};

export function StatusDropdown({ id, value, onChange, size = "md", resync = true }: Props) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingNext, setPendingNext] = useState<CancelStatus | null>(null);
  const [note, setNote] = useState("");
  const meta = statusMeta(value);
  const locked = isTerminal(value);

  function requestChange(next: CancelStatus) {
    setOpen(false);
    if (next === value) return;
    const check = canTransition(value, next);
    if (!check.ok) {
      toast.error("Transição não permitida", { description: check.reason });
      return;
    }
    setNote("");
    setPendingNext(next);
  }

  async function commitChange() {
    if (!pendingNext) return;
    const next = pendingNext;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("cancelamentos")
        .update({
          status: next,
          status_updated_at: new Date().toISOString(),
          status_updated_by: user?.id ?? null,
        } as never)
        .eq("id", id);
      if (error) throw error;

      await supabase.from("cancelamento_status_history").insert({
        cancelamento_id: id,
        from_status: (value ?? null) as CancelStatus | null,
        to_status: next,
        changed_by: user?.id ?? null,
        changed_by_name: profile?.display_name ?? null,
        note: note.trim() || null,
      } as never);

      onChange?.(next);
      toast.success(`Status atualizado: ${statusMeta(next).label}`);
      setPendingNext(null);
      setNote("");

      if (resync) {
        syncCancelamentoToSheet({ data: { id, statusOnly: true } })
          .then((res) => {
            if (!res.ok) {
              toast.warning("Status salvo, planilha não atualizou", {
                description: res.error,
              });
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      toast.error("Falha ao atualizar status", {
        description: e instanceof Error ? e.message : "desconhecido",
      });
    } finally {
      setSaving(false);
    }
  }

  const padding = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";

  return (
    <>
      <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled={saving || locked}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Status atual: ${meta.label}. Clique para alterar.`}
          title={locked ? "Status final — não pode ser alterado" : undefined}
          onClick={(e) => {
            e.preventDefault();
            if (locked) {
              toast.info("Status final", {
                description: `"${meta.label}" não pode mais ser alterado.`,
              });
              return;
            }
            setOpen((o) => !o);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full font-medium border transition-all ${meta.tone} ${padding} ${
            saving ? "opacity-60" : locked ? "opacity-90 cursor-not-allowed" : "hover:brightness-95"
          }`}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {locked ? <Lock className="h-3 w-3 opacity-70" /> : null}
          {meta.label}
          {!locked && <ChevronDown className="h-3 w-3 opacity-70" />}
        </button>
        {open && !locked && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div 
              className="absolute right-0 mt-1 z-50 w-56 rounded-lg border border-border bg-popover shadow-lg p-1 animate-in fade-in slide-in-from-top-1"
              role="listbox"
            >
              {STATUS_OPTIONS.map((opt) => {
                const active = opt.value === value;
                const allowed = canTransition(value, opt.value).ok || active;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={!allowed}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!allowed) return;
                      requestChange(opt.value);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm rounded-md text-left ${
                      allowed ? "hover:bg-accent" : "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full border ${opt.tone}`}
                      />
                      {opt.label}
                    </span>
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {!!pendingNext && (
        <Dialog
          open={!!pendingNext}
          onOpenChange={(o) => {
            if (!o && !saving) {
              setPendingNext(null);
              setNote("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Mudar status para "{pendingNext ? statusMeta(pendingNext).label : ""}"
              </DialogTitle>
              <DialogDescription>
                Adicione uma observação sobre o que foi feito ou por que essa mudança está ocorrendo.
                Ela ficará registrada no histórico do cancelamento.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="status-note">Observação (opcional)</Label>
              <Textarea
                id="status-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: cliente confirmou cancelamento por telefone às 14h."
                rows={4}
                maxLength={500}
              />
              <p className="text-[11px] text-muted-foreground text-right">{note.length}/500</p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPendingNext(null);
                  setNote("");
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={commitChange} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar mudança"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
