import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { syncCancelamentoToSheet } from "./sheets.functions";

const ALLOWED_ROLES = new Set(["admin", "total"]);

async function assertAllowed(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível validar permissões.");
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.some((r) => ALLOWED_ROLES.has(r))) {
    throw new Error("Sem permissão para alterar ou excluir registros.");
  }
}

export const deleteCancelamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAllowed(context.userId);

    // As tabelas relacionadas (histórico) devem ter ON DELETE CASCADE configurado no banco.
    // Caso não tenham, deletaremos o histórico primeiro por segurança.
    await supabaseAdmin.from("cancelamento_status_history").delete().eq("cancelamento_id", data.id);

    const { error } = await supabaseAdmin.from("cancelamentos").delete().eq("id", data.id);

    if (error) {
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const };
  });

export const updateCancelamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        payload: z.record(z.unknown()), // Payload com os campos atualizados
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAllowed(context.userId);

    const { error } = await supabaseAdmin
      .from("cancelamentos")
      .update({
        ...data.payload,
        sheet_synced: false, // Forçamos a re-sincronização
        sheet_error: null,
      })
      .eq("id", data.id);

    if (error) {
      return { ok: false as const, error: error.message };
    }

    // Tentar re-sincronizar imediatamente.
    // Como syncCancelamentoToSheet envia todo o objeto lido do DB,
    // ele irá enviar as atualizações. O Webhook atualizará a planilha!
    try {
      await syncCancelamentoToSheet({ data: { id: data.id } });
    } catch (e) {
      console.error("Erro ao sincronizar update:", e);
    }

    return { ok: true as const };
  });
