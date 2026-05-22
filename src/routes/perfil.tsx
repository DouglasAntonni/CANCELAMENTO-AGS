import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/auth/AuthContext";
import { useServerFn } from "@tanstack/react-start";
import { updateOwnProfile, getUserActivity } from "@/server/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, User, KeyRound, Mail, Activity } from "lucide-react";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil | AGS Telecom" }] }),
  component: () => (
    <RequireAuth>
      <PerfilPage />
    </RequireAuth>
  ),
});

type ActivityData = {
  total_status_updates: number;
  total_history_entries: number;
  recent_history: Array<{
    id: string;
    created_at: string;
    from_status: string | null;
    to_status: string;
    note: string | null;
    cancelamento_id: string;
  }>;
};

function PerfilPage() {
  const { profile, roles, refresh } = useAuth();
  const updateProfile = useServerFn(updateOwnProfile);
  const fetchActivity = useServerFn(getUserActivity);

  const [name, setName] = useState(profile?.display_name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setEmail(profile.email);
    }
  }, [profile]);

  useEffect(() => {
    fetchActivity({ data: {} })
      .then((d) => setActivity(d as ActivityData))
      .catch(() => setActivity(null))
      .finally(() => setLoadingActivity(false));
  }, [fetchActivity]);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const updates: { display_name?: string; email?: string } = {};
    if (name.trim() !== profile.display_name) updates.display_name = name.trim();
    if (email.trim().toLowerCase() !== profile.email.toLowerCase()) updates.email = email.trim();
    if (Object.keys(updates).length === 0) {
      toast.info("Nenhuma alteração");
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ data: updates });
      await refresh();
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) {
      toast.error("A nova senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (!profile?.email) return;
    setSavingPwd(true);
    try {
      // Verify current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPwd,
      });
      if (signInErr) throw new Error("Senha atual incorreta");

      await updateProfile({ data: { password: newPwd } });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      toast.success("Senha alterada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao alterar senha");
    } finally {
      setSavingPwd(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center text-primary-foreground text-2xl font-semibold"
            style={{ background: "var(--gradient-hero)" }}
          >
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meu perfil</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Atualize seus dados pessoais e senha
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {roles.map((r) => (
                <Badge key={r} variant="secondary">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <section className="bg-card rounded-2xl p-6 border border-border shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" /> Dados pessoais
          </h2>
          <form onSubmit={onSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome de exibição</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Trocar o e-mail também muda seu login.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar dados"}
              </Button>
            </div>
          </form>
        </section>

        <section className="bg-card rounded-2xl p-6 border border-border shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <KeyRound className="h-5 w-5 text-primary" /> Trocar senha
          </h2>
          <form onSubmit={onChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">Senha atual</Label>
              <Input
                id="cur"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new">Nova senha</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conf">Confirmar nova senha</Label>
                <Input
                  id="conf"
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingPwd} variant="secondary">
                {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : "Alterar senha"}
              </Button>
            </div>
          </form>
        </section>

        <section className="bg-card rounded-2xl p-6 border border-border shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" /> Minha atividade
          </h2>
          {loadingActivity ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : activity ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Stat label="Status atualizados" value={activity.total_status_updates} />
                <Stat label="Mudanças no histórico" value={activity.total_history_entries} />
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2 text-muted-foreground uppercase tracking-wider">
                  Últimas mudanças
                </h3>
                {activity.recent_history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    Nenhuma atividade registrada ainda.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {activity.recent_history.map((h) => (
                      <li key={h.id} className="py-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {h.from_status && (
                              <>
                                <Badge variant="outline">{h.from_status}</Badge>
                                <span className="text-muted-foreground">→</span>
                              </>
                            )}
                            <Badge>{h.to_status}</Badge>
                          </div>
                          <time className="text-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("pt-BR")}
                          </time>
                        </div>
                        {h.note && <p className="text-xs text-muted-foreground mt-1">{h.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Não foi possível carregar a atividade.
            </p>
          )}
        </section>

        <section className="bg-card rounded-2xl p-6 border border-border shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
            <Mail className="h-5 w-5 text-primary" /> Conta
          </h2>
          <dl className="text-sm grid grid-cols-2 gap-y-2 mt-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{profile.is_active ? "Ativo" : "Inativo"}</dd>
            <dt className="text-muted-foreground">Primeiro acesso</dt>
            <dd>{profile.must_change_credentials ? "Pendente" : "Concluído"}</dd>
          </dl>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
