import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { getOwnProfile } from "@/server/profile.functions";
import { toast } from "sonner";

export type AppRole = "admin" | "total" | "supervisor" | "consultor";

export type Profile = {
  id: string;
  display_name: string;
  email: string;
  must_change_credentials: boolean;
  is_active: boolean;
};

type AuthState = {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  hasRole: (r: AppRole) => boolean;
  hasAnyRole: (r: AppRole[]) => boolean;
  canAccessDashboard: boolean;
  canAccessRegistros: boolean;
  canAccessNovo: boolean;
  canManageMembers: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

let cachedToken: string | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const fetchOwnProfile = useServerFn(getOwnProfile);

  async function loadProfile(uid: string) {
    try {
      const data = await fetchOwnProfile();
      const loadedProfile = data.profile as Profile | null;
      if (loadedProfile && loadedProfile.is_active === false) {
        toast.error("Conta desativada. Fale com o administrador.");
        await supabase.auth.signOut();
        return;
      }
      setProfile(loadedProfile);
      setRoles((data.roles as AppRole[]) ?? []);
    } catch (err) {
      console.error("Failed to load profile:", err);
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar perfil. Verifique os logs.",
      );
      setProfile(null);
      setRoles([]);
      if (err instanceof Error && err.message.toLowerCase().includes("unauthorized")) {
        supabase.auth.signOut().catch(console.error);
      }
    }
  }

  useEffect(() => {
    // Inject Authorization header for TanStack server function calls
    if (typeof window !== "undefined" && !(window as any).__serverFnFetchPatched) {
      (window as any).__serverFnFetchPatched = true;
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          let url = "";
          if (typeof input === "string") {
            url = input;
          } else if (input instanceof URL) {
            url = input.toString();
          } else if (input && "url" in input) {
            url = input.url;
          }
          if (url && !url.includes("supabase.co")) {
            const token = cachedToken;
            if (token) {
              const headers = new Headers(
                init?.headers || (input instanceof Request ? input.headers : undefined),
              );
              if (!headers.has("authorization")) {
                headers.set("authorization", `Bearer ${token}`);
              }
              return originalFetch(input, { ...init, headers });
            }
          }
        } catch {
          // fall through
        }
        return originalFetch(input, init);
      };
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      cachedToken = s?.access_token ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        // Defer to avoid deadlock
        queueMicrotask(() => {
          loadProfile(s.user!.id).finally(() => setLoading(false));
        });
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      cachedToken = s?.access_token ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const hasRole = (r: AppRole) => roles.includes(r);
  const hasAnyRole = (rs: AppRole[]) => rs.some((r) => roles.includes(r));

  const value: AuthState = {
    loading,
    user,
    session,
    profile,
    roles,
    hasRole,
    hasAnyRole,
    canManageMembers: hasRole("admin"),
    canAccessDashboard: hasAnyRole(["admin", "total", "supervisor", "consultor"]),
    canAccessNovo: hasAnyRole(["admin", "total", "supervisor", "consultor"]),
    canAccessRegistros: hasAnyRole(["admin", "total", "consultor"]),
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (user) await loadProfile(user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
