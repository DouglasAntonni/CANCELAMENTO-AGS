import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth, type AppRole } from "./AuthContext";
import { Loader2 } from "lucide-react";

type Props = {
  children: ReactNode;
  roles?: AppRole[];
};

export function RequireAuth({ children, roles }: Props) {
  const { loading, user, profile, roles: useAuthRoles, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: pathname } as never });
      return;
    }
    if (profile?.must_change_credentials && pathname !== "/trocar-credenciais") {
      navigate({ to: "/trocar-credenciais" });
      return;
    }
    // We don't redirect to /sem-acesso here anymore, we render it directly to prevent loops!
  }, [loading, user, profile, pathname, roles, hasAnyRole, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }
  if (profile?.must_change_credentials && pathname !== "/trocar-credenciais") return null;

  if (roles && !hasAnyRole(roles)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
        <div className="max-w-md space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Acesso Restrito</h1>
          <p className="text-muted-foreground text-sm">
            Seu usuário ({user.email}) não possui as permissões necessárias para acessar esta página.
          </p>
          <div className="text-left text-xs bg-muted/50 p-4 rounded-xl border border-border mt-4">
            <p className="font-semibold mb-1">Diagnóstico:</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li>Sua conta está autenticada no sistema.</li>
              <li>Mas seu nível de acesso atual é: <strong>{useAuthRoles.length > 0 ? useAuthRoles.join(", ") : "Nenhum (Vazio)"}</strong>.</li>
              <li>A página exige um destes papéis: {roles.join(", ")}.</li>
            </ul>
            {useAuthRoles.length === 0 && (
              <p className="mt-3 text-destructive font-medium">
                Dica: Se você acabou de criar este usuário no painel do Supabase, você precisa adicionar um registro na tabela "user_roles" vinculando seu user_id à role "admin".
              </p>
            )}
          </div>
          <button onClick={() => navigate({ to: "/" })} className="text-primary hover:underline text-sm font-medium mt-4">
            Voltar para o Início
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
