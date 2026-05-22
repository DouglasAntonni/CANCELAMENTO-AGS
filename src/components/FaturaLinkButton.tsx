import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getFaturaSignedUrl } from "@/server/faturas.functions";
import { toast } from "sonner";

type Props = {
  value: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Botão que resolve uma fatura (path do storage privado OU URL externa) e abre
 * em nova aba. Para paths gera URL assinada de curta duração.
 */
export function FaturaLinkButton({ value, className, children }: Props) {
  const [loading, setLoading] = useState(false);
  const resolve = useServerFn(getFaturaSignedUrl);

  async function open(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await resolve({ data: { value } });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao abrir fatura");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-60"
      }
    >
      {children ?? (
        <>
          Fatura{" "}
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ExternalLink className="h-3 w-3" />
          )}
        </>
      )}
    </button>
  );
}
