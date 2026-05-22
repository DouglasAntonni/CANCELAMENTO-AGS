import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import {
  listMembers,
  createMember,
  updateMemberRoles,
  resetMemberPassword,
  deleteMember,
} from "@/server/members.functions";
import { adminUpdateMember, getUserActivity } from "@/server/profile.functions";
import { toast } from "sonner";
import { Loader2, Plus, KeyRound, Trash2, Pencil, Users, Activity, Power } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { AppRole } from "@/auth/AuthContext";

export const Route = createFileRoute("/membros")({
  head: () => ({ meta: [{ title: "Membros | AGS Telecom" }] }),
  component: () => (
    <RequireAuth roles={["admin"]}>
      <MembrosPage />
    </RequireAuth>
  ),
});

const ALL_ROLES: { value: AppRole; label: string; hint: string }[] = [
  { value: "admin", label: "Admin", hint: "Cadastra membros, acesso total" },
  { value: "total", label: "Acesso total", hint: "Tudo, sem cadastrar membros" },
  { value: "supervisor", label: "Supervisor", hint: "Dashboard + Novo registro" },
  { value: "consultor", label: "Consultor", hint: "Dashboard + Registros + Novo" },
];

type Member = {
  id: string;
  display_name: string;
  email: string;
  must_change_credentials: boolean;
  is_active: boolean;
  created_at: string;
  roles: string[];
};

function MembrosPage() {
  const list = useServerFn(listMembers);
  const create = useServerFn(createMember);
  const update = useServerFn(updateMemberRoles);
  const reset = useServerFn(resetMemberPassword);
  const remove = useServerFn(deleteMember);
  const adminUpdate = useServerFn(adminUpdateMember);
  const fetchActivity = useServerFn(getUserActivity);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const data = await list();
      setMembers(Array.isArray(data) ? (data as Member[]) : []);
    } catch (e) {
      setMembers([]);
      toast.error(e instanceof Error ? e.message : "Falha ao listar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Users className="h-7 w-7 text-primary" /> Membros
            </h1>
            <p className="text-muted-foreground mt-1">
              Cadastre e gerencie os usuários do sistema.
            </p>
          </div>
          <NewMemberDialog
            onCreated={reload}
            create={async (v) => {
              await create({ data: v });
            }}
          />
        </div>

        <div className="bg-card rounded-xl border border-border shadow-[var(--shadow-card)] overflow-hidden">
          {loading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.display_name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map((r) => (
                          <Badge key={r} variant="secondary">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={m.is_active}
                          onCheckedChange={async (v) => {
                            try {
                              await adminUpdate({
                                data: { user_id: m.id, is_active: v },
                              });
                              toast.success(v ? "Usuário ativado" : "Usuário desativado");
                              reload();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Falha");
                            }
                          }}
                        />
                        {m.must_change_credentials && <Badge variant="outline">1º acesso</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        member={m}
                        onUpdateRoles={async (roles) => {
                          await update({ data: { user_id: m.id, roles } });
                          toast.success("Perfis atualizados");
                          reload();
                        }}
                        onUpdateInfo={async (info) => {
                          await adminUpdate({ data: { user_id: m.id, ...info } });
                          toast.success("Dados atualizados");
                          reload();
                        }}
                        onReset={async (password) => {
                          await reset({ data: { user_id: m.id, password } });
                          toast.success("Senha redefinida");
                          reload();
                        }}
                        onDelete={async () => {
                          await remove({ data: { user_id: m.id } });
                          toast.success("Membro removido");
                          reload();
                        }}
                        loadActivity={() => fetchActivity({ data: { user_id: m.id } })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Nenhum membro cadastrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  );
}

function NewMemberDialog({
  onCreated,
  create,
}: {
  onCreated: () => void;
  create: (v: {
    display_name: string;
    email: string;
    password: string;
    roles: AppRole[];
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AppRole[]>(["consultor"]);
  const [loading, setLoading] = useState(false);

  function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    setPassword(Array.from(arr, (n) => alphabet[n % alphabet.length]).join(""));
  }

  function toggle(r: AppRole) {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (roles.length === 0) {
      toast.error("Selecione ao menos um perfil");
      return;
    }
    if (password.length < 10) {
      toast.error("Senha inicial deve ter ao menos 10 caracteres");
      return;
    }
    setLoading(true);
    try {
      await create({
        display_name: name.trim(),
        email: email.trim(),
        password,
        roles,
      });
      toast.success("Membro cadastrado");
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRoles(["consultor"]);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Novo membro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo membro</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="nome@agstelecom.com.br"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Senha inicial</Label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-xs text-primary hover:underline"
              >
                Gerar segura
              </button>
            </div>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              placeholder="Mínimo 10 caracteres"
            />
            <p className="text-[11px] text-muted-foreground">
              Senha exclusiva por usuário. O membro será obrigado a trocar e-mail e senha no
              primeiro acesso.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Perfis de acesso</Label>
            <div className="grid gap-2">
              {ALL_ROLES.map((r) => (
                <label
                  key={r.value}
                  className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/50"
                >
                  <Checkbox
                    checked={roles.includes(r.value)}
                    onCheckedChange={() => toggle(r.value)}
                  />
                  <div className="leading-tight">
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{r.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ActivityResult = {
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

function RowActions({
  member,
  onUpdateRoles,
  onUpdateInfo,
  onReset,
  onDelete,
  loadActivity,
}: {
  member: Member;
  onUpdateRoles: (roles: AppRole[]) => Promise<void>;
  onUpdateInfo: (info: {
    display_name?: string;
    email?: string;
    must_change_credentials?: boolean;
  }) => Promise<void>;
  onReset: (password: string) => Promise<void>;
  onDelete: () => Promise<void>;
  loadActivity: () => Promise<unknown>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>(member.roles as AppRole[]);
  const [name, setName] = useState(member.display_name);
  const [email, setEmail] = useState(member.email);
  const [forceReset, setForceReset] = useState(member.must_change_credentials);
  const [savingEdit, setSavingEdit] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");

  function genResetPwd() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    setNewPwd(Array.from(arr, (n) => alphabet[n % alphabet.length]).join(""));
  }

  const [actOpen, setActOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityResult | null>(null);
  const [loadingAct, setLoadingAct] = useState(false);

  async function openActivity() {
    setActOpen(true);
    setLoadingAct(true);
    try {
      const data = (await loadActivity()) as ActivityResult;
      setActivity(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar atividade");
    } finally {
      setLoadingAct(false);
    }
  }

  async function saveEdit() {
    setSavingEdit(true);
    try {
      const info: {
        display_name?: string;
        email?: string;
        must_change_credentials?: boolean;
      } = {};
      if (name.trim() !== member.display_name) info.display_name = name.trim();
      if (email.trim().toLowerCase() !== member.email.toLowerCase()) info.email = email.trim();
      if (forceReset !== member.must_change_credentials) info.must_change_credentials = forceReset;
      if (Object.keys(info).length > 0) await onUpdateInfo(info);

      const sortedNew = [...roles].sort();
      const sortedCur = [...member.roles].sort();
      if (JSON.stringify(sortedNew) !== JSON.stringify(sortedCur)) {
        await onUpdateRoles(roles);
      }
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" title="Ver atividade" onClick={openActivity}>
        <Activity className="h-4 w-4" />
      </Button>

      <Dialog open={actOpen} onOpenChange={setActOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Atividade — {member.display_name}</DialogTitle>
          </DialogHeader>
          {loadingAct ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : activity ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status atualizados
                  </div>
                  <div className="text-2xl font-bold">{activity.total_status_updates}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Histórico
                  </div>
                  <div className="text-2xl font-bold">{activity.total_history_entries}</div>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {activity.recent_history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Sem mudanças registradas.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {activity.recent_history.map((h) => (
                      <li key={h.id} className="py-2 text-sm">
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
                          <time className="text-[11px] text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("pt-BR")}
                          </time>
                        </div>
                        {h.note && <p className="text-xs text-muted-foreground mt-1">{h.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar — {member.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Perfis</Label>
              <div className="grid gap-2">
                {ALL_ROLES.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-start gap-3 rounded-md border border-border p-2.5 cursor-pointer hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={roles.includes(r.value)}
                      onCheckedChange={() =>
                        setRoles((cur) =>
                          cur.includes(r.value)
                            ? cur.filter((x) => x !== r.value)
                            : [...cur, r.value],
                        )
                      }
                    />
                    <div className="leading-tight">
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-md border border-border p-2.5">
              <Checkbox checked={forceReset} onCheckedChange={(v) => setForceReset(!!v)} />
              <div className="leading-tight">
                <div className="text-sm font-medium flex items-center gap-1">
                  <Power className="h-3.5 w-3.5" /> Forçar troca de credenciais no próximo login
                </div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Redefinir senha">
            <KeyRound className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Nova senha</Label>
              <button
                type="button"
                onClick={genResetPwd}
                className="text-xs text-primary hover:underline"
              >
                Gerar segura
              </button>
            </div>
            <Input
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              minLength={10}
              placeholder="Mínimo 10 caracteres"
            />
            <p className="text-[11px] text-muted-foreground">
              O membro precisará trocar novamente no próximo acesso.
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={newPwd.length < 10}
              onClick={async () => {
                await onReset(newPwd);
                setNewPwd("");
                setResetOpen(false);
              }}
            >
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Remover">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {member.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O usuário perderá acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
