import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.enum(["admin", "total", "supervisor", "consultor"]);

async function assertAdmin(userId: string) {
  const { data: r } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (!(r ?? []).some((x) => x.role === "admin")) {
    throw new Error("Acesso negado");
  }
}

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { supabase, userId } = context;
      await assertAdmin(userId);

      const { data: profiles, error } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, email, must_change_credentials, is_active, created_at")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);

      const { data: rolesAll } = await supabaseAdmin.from("user_roles").select("user_id, role");

      const map = new Map<string, string[]>();
      (rolesAll ?? []).forEach((r) => {
        const arr = map.get(r.user_id) ?? [];
        arr.push(r.role);
        map.set(r.user_id, arr);
      });

      const list = Array.isArray(profiles) ? profiles : [];
      return list.map((p) => ({
        ...p,
        roles: map.get(p.id) ?? [],
      }));
    } catch (err) {
      console.error("listMembers failed:", err);
      throw err instanceof Error ? err : new Error("Falha ao listar membros");
    }
  });

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        display_name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(180),
        password: z.string().min(8).max(72),
        roles: z.array(RoleSchema).min(1).max(4),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: data.display_name,
        must_change_credentials: true,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar");

    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      display_name: data.display_name,
      email: data.email,
      must_change_credentials: true,
      is_active: true,
    });

    const rolesToInsert = data.roles.map(role => ({ user_id: created.user.id, role }));
    await supabaseAdmin.from("user_roles").upsert(rolesToInsert, { onConflict: "user_id,role" });

    return { id: created.user.id };
  });

export const updateMemberRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        roles: z.array(RoleSchema).min(1).max(4),
        is_active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(userId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const rolesToInsert = data.roles.map(role => ({ user_id: data.user_id, role }));
    await supabaseAdmin.from("user_roles").insert(rolesToInsert);
    if (typeof data.is_active === "boolean") {
      await supabaseAdmin
        .from("profiles")
        .update({ is_active: data.is_active })
        .eq("id", data.user_id);
    }
    return { ok: true };
  });

export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        password: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(userId);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_credentials: true })
      .eq("id", data.user_id);
    return { ok: true };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("Você não pode remover a si mesmo");
    await assertAdmin(userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
