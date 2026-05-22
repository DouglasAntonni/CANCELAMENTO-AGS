import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  FilePlus,
  List,
  Users,
  LogOut,
  ChevronDown,
  User,
  Menu,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/auth/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const { pathname } = useLocation();
  const {
    profile,
    roles,
    canAccessDashboard,
    canAccessRegistros,
    canAccessNovo,
    canManageMembers,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const linkBase =
    "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all";
  const active = "bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] scale-[1.02]";
  const inactive = "text-muted-foreground hover:text-foreground hover:bg-accent";

  const links = [
    canAccessNovo && { to: "/", label: "Novo", icon: FilePlus },
    canAccessDashboard && { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    canAccessRegistros && { to: "/registros", label: "Registros", icon: List },
    canManageMembers && { to: "/membros", label: "Membros", icon: Users },
  ].filter(Boolean) as { to: string; label: string; icon: typeof FilePlus }[];

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center text-primary-foreground"
            style={{ background: "var(--gradient-hero)" }}
          >
            <FilePlus className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-foreground text-sm">AGS Telecom</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Cancelamentos
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => {
              const Icon = l.icon;
              const isActive = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`${linkBase} ${isActive ? active : inactive}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center md:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger className="p-2 ml-1 text-muted-foreground hover:text-foreground">
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[250px] sm:w-[300px]">
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-6">
                  {links.map((l) => {
                    const Icon = l.icon;
                    const isActive = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
                    return (
                      <Link
                        key={l.to}
                        to={l.to}
                        onClick={() => setSheetOpen(false)}
                        className={`${linkBase} ${isActive ? active : inactive}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{l.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm hover:bg-accent">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-primary-foreground text-xs font-semibold"
                  style={{ background: "var(--gradient-hero)" }}
                >
                  {profile.display_name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:inline text-foreground">
                  {profile.display_name.split(" ")[0]}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{profile.display_name}</div>
                  <div className="text-xs text-muted-foreground">{profile.email}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                    {roles.join(" · ") || "sem perfil"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
                  <User className="h-4 w-4" /> Meu perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
    </header>
  );
}
