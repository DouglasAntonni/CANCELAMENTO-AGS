import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SPREADSHEET_ID, SHEET_NAME } from "@/lib/sheet";

const ALLOWED_ROLES = new Set(["admin", "total", "supervisor", "consultor"]);

async function assertAllowed(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível validar permissões.");
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.some((r) => ALLOWED_ROLES.has(r))) {
    throw new Error("Sem permissão para sincronizar com a planilha.");
  }
}

// Substituído: não usamos mais GATEWAY_URL nem ID_COLUMN aqui.
// A lógica de busca e append agora está toda no Apps Script (Webhook).

function friendlyError(status: number, body: string): string {
  if (status === 404) return "Webhook do Google Sheets não encontrado (URL inválida).";
  if (status >= 500) return "O Webhook do Google Sheets falhou ao processar a requisição.";
  try {
    const j = JSON.parse(body) as { error?: string };
    if (j.error) return `Google Sheets: ${j.error}`;
  } catch {
    /* ignore */
  }
  return `Falha ao conectar com o Webhook da planilha (HTTP ${status}).`;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

function buildRowValues(row: Record<string, unknown>): string[] {
  return [
    new Date(row.created_at as string).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }),
    s(row.operadora),
    s(row.supervisor),
    s(row.nome_cliente),
    s(row.cpf),
    s(row.cnpj),
    s(row.email),
    s(row.nome_mae),
    s(row.data_nascimento),
    s(row.endereco_completo),
    s(row.ponto_referencia),
    s(row.contato_1),
    s(row.contato_2),
    s(row.fixo),
    s(row.forma_pagamento),
    s(row.banco),
    s(row.agencia),
    s(row.conta),
    s(row.queima),
    s(row.numero_contrato),
    row.cancelar_com_multa ? "Sim" : "Não",
    fmtMoney(row.valor_maximo_multa as number | null),
    s(row.fatura_url),
    s(row.status),
  ];
}

async function markSyncOk(id: string) {
  await supabaseAdmin
    .from("cancelamentos")
    .update({
      sheet_synced: true,
      sheet_synced_at: new Date().toISOString(),
      sheet_error: null,
    })
    .eq("id", id);
}

async function markSyncErr(id: string, error: string) {
  await supabaseAdmin
    .from("cancelamentos")
    .update({ sheet_synced: false, sheet_error: error })
    .eq("id", id);
}

export const syncCancelamentoToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        statusOnly: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAllowed(context.userId);

    const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!GOOGLE_SHEETS_WEBHOOK_URL) {
      const error =
        "URL do Webhook do Google Sheets não configurada no .env (GOOGLE_SHEETS_WEBHOOK_URL).";
      await markSyncErr(data.id, error);
      return { ok: false as const, error };
    }

    const { data: row, error: readErr } = await supabaseAdmin
      .from("cancelamentos")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (readErr || !row) {
      return {
        ok: false as const,
        error: readErr?.message ?? "Registro não encontrado.",
      };
    }

    const payload = {
      id: data.id,
      statusOnly: data.statusOnly,
      status: data.statusOnly ? s(row.status) : undefined,
      values: data.statusOnly ? undefined : buildRowValues(row),
    };

    try {
      const res = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: "POST",
        // Google Apps Script requires body to be stringified, no specific headers needed since it's a web app
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let responseJson;
      try {
        responseJson = JSON.parse(text);
      } catch (e) {
        // Se a resposta não for JSON, pode ser que o Web App esteja retornando erro HTML
        const errStr = friendlyError(res.status, text);
        await markSyncErr(data.id, errStr);
        return { ok: false as const, error: errStr };
      }

      if (!responseJson.ok) {
        const errStr = responseJson.error || friendlyError(res.status, text);
        await markSyncErr(data.id, errStr);
        return { ok: false as const, error: errStr };
      }

      await markSyncOk(data.id);
      return { ok: true as const };
    } catch (err) {
      const error = `Erro de rede ao acessar Webhook do Google Sheets: ${err instanceof Error ? err.message : "desconhecido"}`;
      await markSyncErr(data.id, error);
      return { ok: false as const, error };
    }
  });
