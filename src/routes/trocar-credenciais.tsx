import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { changeCredentials } from "@/server/credentials.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/trocar-credenciais")({
  head: () => ({ meta: [{ title: "Trocar credenciais" }] }),
  component: TrocarPage,
});

function TrocarPage() {
  const { user, profile, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (profile && !profile.must_change_credentials) navigate({ to: "/" });
    if (profile) setNewEmail(profile.email);
  }, [loading, user, profile, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSubmitting(true);
    try {
      const updates: { email?: string; password: string } = { password: newPassword };
      if (newEmail.trim() && newEmail.trim().toLowerCase() !== profile?.email.toLowerCase()) {
        updates.email = newEmail.trim();
      }
      
      const res = await changeCredentials({ data: updates });
      if (!res.ok) {
        throw new Error("Falha ao atualizar credenciais");
      }

      await refresh();
      toast.success("Credenciais atualizadas");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center text-primary-foreground mb-4"
            style={{ background: "var(--gradient-hero)" }}
          >
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Primeiro acesso</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina seu e-mail e senha pessoais</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="bg-card rounded-2xl p-6 border border-border shadow-[var(--shadow-card)] space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Novo e-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Pode manter o e-mail atual ou trocar pelo seu pessoal.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd">Nova senha</Label>
            <Input
              id="pwd"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd2">Confirmar senha</Label>
            <Input
              id="pwd2"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e continuar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
