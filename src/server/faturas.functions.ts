import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gera URL assinada (curta duração) para um arquivo do bucket privado `faturas`.
 * Aceita tanto um path do storage (ex: "uuid.pdf") quanto uma URL externa
 * (http/https), retornando a URL externa inalterada.
 */
export const getFaturaSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ value: z.string().min(1).max(2048) }).parse(input))
  .handler(async ({ data }) => {
    const v = data.value.trim();
    if (/^https?:\/\//i.test(v)) {
      return { url: v, kind: "external" as const };
    }
    const { data: signed, error } = await supabaseAdmin.storage
      .from("faturas")
      .createSignedUrl(v, 60 * 60); // 1h
    if (error || !signed?.signedUrl) {
      throw new Error(error?.message ?? "Falha ao gerar URL da fatura.");
    }
    return { url: signed.signedUrl, kind: "signed" as const };
  });
