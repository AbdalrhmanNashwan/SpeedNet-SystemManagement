import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { SortableTh } from "@/components/SortableTh";
import { useTableSort } from "@/hooks/useTableSort";
import { useZones } from "@/hooks/useZones";
import { useT } from "@/i18n";
import type { User, Role } from "@/types";

const ROLES: Role[] = ["admin", "editor", "viewer", "agent"];

// Sorting by role should group by privilege, not alphabetically.
const ROLE_ORDER: Record<Role, number> = { admin: 0, editor: 1, agent: 2, viewer: 3 };

// This table is roomier than the dense data tables, so it keeps its own header
// styling rather than SortableTh's default.
const USERS_TH =
  "text-start px-4 py-3 text-[10px] text-muted2 uppercase tracking-wide " +
  "font-extrabold border-b border-line bg-panel2";

// The protected owner account — the backend forbids changing its role, active
// state, or deleting it. Mirror that here so the controls are locked in the UI.
const OWNER_EMAIL = "abdalrhmannash.dev@gmail.com";
const isOwner = (email: string) => email.trim().toLowerCase() === OWNER_EMAIL;

// Capability-first labels so an admin picks by what the user can DO.
const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin — full access",
  editor: "Editor — add, edit & delete",
  viewer: "Viewer — watch only",
  agent: "Agent — watch own zone",
};

function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/users")).data,
  });
}

function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; full_name?: string; role: Role; zone_id?: number | null; password: string; can_create: boolean; can_update: boolean; can_delete: boolean }) =>
      (await api.post<User>("/users", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<User & { password?: string }> }) =>
      (await api.patch<User>(`/users/${id}`, patch)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

const CAP_LABELS = {
  can_create: "Create",
  can_update: "Update",
  can_delete: "Delete",
} as const;

// Only agents get per-user capability toggles. The other roles have fixed access
// implied by the role, so switching to them sets the matching flags automatically.
function capsForRole(role: Role): Partial<Record<"can_create" | "can_update" | "can_delete", boolean>> {
  if (role === "editor") return { can_create: true, can_update: true, can_delete: true };
  if (role === "viewer") return { can_create: false, can_update: false, can_delete: false };
  return {}; // admin (implicitly all) / agent (keep the user's toggles)
}

// A compact on/off pill for a single capability.
function CapToggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={label}
      className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-colors ${
        on ? "bg-green/15 border-green/50 text-green"
           : "bg-bg2 border-line text-muted2 hover:border-line2"
      }`}
    >
      {label}
    </button>
  );
}

const ROLE_COLORS: Record<Role, string> = {
  admin: "text-red",
  editor: "text-orange",
  viewer: "text-muted",
  agent: "text-cyan",
};

function AddUserModal({ onClose }: { onClose: () => void }) {
  const { data: zones } = useZones();
  const create = useCreateUser();
  const t = useT();
  const [form, setForm] = useState({ email: "", full_name: "", role: "viewer" as Role, zone_id: "", password: "" });
  const [caps, setCaps] = useState({ can_create: false, can_update: false, can_delete: false });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      email: form.email,
      full_name: form.full_name || undefined,
      role: form.role,
      zone_id: form.zone_id ? Number(form.zone_id) : null,
      password: form.password,
      // agents are configured with explicit toggles; other roles imply their caps
      ...({ can_create: false, can_update: false, can_delete: false,
            ...(form.role === "agent" ? caps : capsForRole(form.role)) }),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-8 w-full max-w-md">
        <h2 className="text-lg font-extrabold mb-6">{t("Add User")}</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {(["email", "full_name", "password"] as const).map((k) => (
            <div key={k}>
              <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">{t({ email: "Email", full_name: "Name", password: "Password" }[k])}</label>
              <input type={k === "password" ? "password" : k === "email" ? "email" : "text"}
                required={k !== "full_name"} value={form[k]} onChange={(e) => set(k, e.target.value)}
                className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue" />
            </div>
          ))}
          <div>
            <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">{t("Role")}</label>
            <select value={form.role} onChange={(e) => set("role", e.target.value)}
              className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue">
              {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABELS[r])}</option>)}
            </select>
          </div>
          {form.role === "agent" && (
            <div>
              <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">{t("Zone")}</label>
              <select value={form.zone_id} onChange={(e) => set("zone_id", e.target.value)}
                className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue">
                <option value="">{t("— none —")}</option>
                {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
          )}
          {form.role === "agent" && (
            <div>
              <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">{t("Permissions")}</label>
              <div className="flex gap-1.5">
                {(["can_create", "can_update", "can_delete"] as const).map((cap) => (
                  <CapToggle key={cap} label={t(CAP_LABELS[cap])} on={caps[cap]}
                    onToggle={() => setCaps((c) => ({ ...c, [cap]: !c[cap] }))} />
                ))}
              </div>
              <p className="text-[11px] text-muted2 mt-1">{t("Leave all off for view-only access.")}</p>
            </div>
          )}
          {create.error && <p className="text-red text-xs">{String(create.error)}</p>}
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-line text-muted text-sm hover:border-line2">{t("Cancel")}</button>
            <button type="submit" disabled={create.isPending}
              className="flex-1 py-2 rounded-lg bg-blue text-white text-sm font-bold disabled:opacity-50">
              {create.isPending ? t("Saving…") : t("Create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const { data: users, isLoading } = useUsers();
  const { data: zones } = useZones();
  const t = useT();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [showAdd, setShowAdd] = useState(false);

  const zoneName = (id: number | null) => zones?.find((z) => z.id === id)?.name ?? "—";

  // Sorts by what each column *displays* — the zone's name, not its id, and
  // role by privilege rather than alphabetically.
  const accessors = useMemo(() => ({
    email: (u: User) => u.email,
    full_name: (u: User) => u.full_name,
    role: (u: User) => ROLE_ORDER[u.role],
    zone: (u: User) => zones?.find((z) => z.id === u.zone_id)?.name ?? null,
    permissions: (u: User) =>
      Number(u.can_create) + Number(u.can_update) + Number(u.can_delete),
    is_active: (u: User) => u.is_active,
  }), [zones]);

  const { sorted, sort, toggle: toggleSort } = useTableSort(users ?? [], { accessors });

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center mb-8">
        <h1 className="text-2xl font-extrabold">{t("Users")}</h1>
        <button onClick={() => setShowAdd(true)}
          className="ms-auto bg-blue text-white text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-blue/80">
          {t("+ Add User")}
        </button>
      </div>

      {isLoading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : (
        <div className="border border-line rounded-[13px] overflow-x-auto bg-panel">
          <table className="w-full text-sm border-collapse min-w-[880px]">
            <thead>
              <tr>
                {([
                  ["Email", "email"], ["Name", "full_name"], ["Role", "role"],
                  ["Zone", "zone"], ["Permissions", "permissions"],
                  ["Active", "is_active"], ["", undefined],
                ] as [string, string | undefined][]).map(([label, key]) => (
                  <SortableTh key={label || "actions"} label={label && t(label)}
                    sortKey={key} sort={sort} onSort={toggleSort} thClass={USERS_TH} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const owner = isOwner(u.email);
                return (
                <tr key={u.id} className="border-b border-line/50 hover:bg-panel2/50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {u.email}
                    {owner && <span className="ms-2 text-[10px] font-extrabold text-amber uppercase tracking-wide">{t("Owner")}</span>}
                  </td>
                  <td className="px-4 py-3">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {owner ? (
                      <span className={`text-xs font-bold ${ROLE_COLORS.admin}`} title={t("Protected owner account")}>
                        {t(ROLE_LABELS.admin)}
                      </span>
                    ) : (
                    <select
                      value={u.role}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        updateUser.mutate({ id: u.id, patch: { role, ...capsForRole(role) } });
                      }}
                      title={t("Set what this user can do")}
                      className={`bg-bg2 border border-line rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-blue cursor-pointer ${ROLE_COLORS[u.role]}`}
                    >
                      {ROLES.map((r) => <option key={r} value={r} className="text-text">{t(ROLE_LABELS[r])}</option>)}
                    </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {u.role === "agent" ? (
                      <select
                        value={u.zone_id ?? ""}
                        onChange={(e) => updateUser.mutate({ id: u.id, patch: { zone_id: e.target.value ? Number(e.target.value) : null } })}
                        className="bg-bg2 border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-blue cursor-pointer"
                      >
                        <option value="">{t("— none —")}</option>
                        {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                      </select>
                    ) : zoneName(u.zone_id ?? null)}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "admin" ? (
                      <span className="text-[11px] text-muted2">{t("Full access")}</span>
                    ) : u.role === "editor" ? (
                      <span className="text-[11px] text-muted2">{t("Add, edit & delete")}</span>
                    ) : u.role === "viewer" ? (
                      <span className="text-[11px] text-muted2">{t("View only")}</span>
                    ) : (
                      <div className="flex gap-1.5 whitespace-nowrap">
                        {(["can_create", "can_update", "can_delete"] as const).map((cap) => (
                          <CapToggle key={cap} label={t(CAP_LABELS[cap])} on={u[cap]}
                            onToggle={() => updateUser.mutate({ id: u.id, patch: { [cap]: !u[cap] } })} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {owner ? (
                      <span className="text-xs font-bold text-green" title={t("Protected owner account")}>{t("Active")}</span>
                    ) : (
                    <button
                      onClick={() => updateUser.mutate({ id: u.id, patch: { is_active: !u.is_active } })}
                      className={`text-xs font-bold ${u.is_active ? "text-green" : "text-red"} hover:underline`}
                    >
                      {u.is_active ? t("Active") : t("Inactive")}
                    </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {owner ? (
                      <span className="text-xs text-muted2" title={t("Protected owner account")}>🔒</span>
                    ) : (
                    <button
                      onClick={() => { if (confirm(t("Delete user {email}?", { email: u.email }))) deleteUser.mutate(u.id); }}
                      className="text-xs text-red hover:underline"
                    >
                      {t("Delete")}
                    </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
    </main>
  );
}
