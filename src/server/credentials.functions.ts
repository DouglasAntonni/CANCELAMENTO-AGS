import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const changeCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(180).optional(),
        password: z.string().min(8).max(72),
      })
      .parse(input)
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;

    const authUpdates: { email?: string; password?: string } = {
      password: data.password,
    };
    if (data.email) {
      authUpdates.email = data.email;
    }

    // Update auth user
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      authUpdates
    );
    if (authError) throw new Error(authError.message);

    // Update profile
    const profileUpdates: { email?: string; must_change_credentials: boolean } = {
      must_change_credentials: false,
    };
    if (data.email) {
      profileUpdates.email = data.email;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdates as never)
      .eq("id", userId);
      
    if (profileError) throw new Error(profileError.message);

    return { ok: true };
  });
