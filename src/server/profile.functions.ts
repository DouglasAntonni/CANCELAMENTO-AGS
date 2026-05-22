import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: { role: string }) => r.role === "admin");
}

export const getOwnProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [profileRes, rolesRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileRes.error) throw new Error("Profile error: " + profileRes.error.message);
    if (rolesRes.error) throw new Error("Roles error: " + rolesRes.error.message);

    return {
      profile: profileRes.data ?? null,
      roles: (rolesRes.data ?? []).map((r: { role: string }) => r.role.toLowerCase()),
    };
  });

export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        display_name: z.string().trim().min(2).max(120).optional(),
        email: z.string().trim().email().max(180).optional(),
        password: z.string().min(8).max(72).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;

    const authUpdates: { email?: string; password?: string } = {};
    if (data.email) authUpdates.email = data.email;
    if (data.password) authUpdates.password = data.password;

    if (Object.keys(authUpdates).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
      if (error) throw new Error(error.message);
    }

    const profileUpdates: Record<string, unknown> = {};
    if (data.display_name) profileUpdates.display_name = data.display_name;
    if (data.email) profileUpdates.email = data.email;

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates as never)
        .eq("id", userId);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const adminUpdateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        display_name: z.string().trim().min(2).max(120).optional(),
        email: z.string().trim().email().max(180).optional(),
        is_active: z.boolean().optional(),
        must_change_credentials: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!(await isAdmin(userId))) throw new Error("Acesso negado");

    const authUpdates: { email?: string } = {};
    if (data.email) authUpdates.email = data.email;
    if (Object.keys(authUpdates).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, authUpdates);
      if (error) throw new Error(error.message);
    }

    const updates: Record<string, unknown> = {};
    if (data.display_name !== undefined) updates.display_name = data.display_name;
    if (data.email !== undefined) updates.email = data.email;
    if (data.is_active !== undefined) updates.is_active = data.is_active;
    if (data.must_change_credentials !== undefined)
      updates.must_change_credentials = data.must_change_credentials;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(updates as never)
        .eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const getUserActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const target = data.user_id ?? userId;

    // Only admins can view other users' activity
    if (target !== userId && !(await isAdmin(userId))) {
      throw new Error("Acesso negado");
    }

    const [updatesRes, historyRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from("cancelamentos")
        .select("id", { count: "exact", head: true })
        .eq("status_updated_by", target),
      supabaseAdmin
        .from("cancelamento_status_history")
        .select("id, created_at, from_status, to_status, note, cancelamento_id", {
          count: "exact",
        })
        .eq("changed_by", target)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("profiles")
        .select("display_name, email, is_active, must_change_credentials, created_at")
        .eq("id", target)
        .maybeSingle(),
    ]);

    return {
      profile: profileRes.data ?? null,
      total_status_updates: updatesRes.count ?? 0,
      total_history_entries: historyRes.count ?? 0,
      recent_history: historyRes.data ?? [],
    };
  });
