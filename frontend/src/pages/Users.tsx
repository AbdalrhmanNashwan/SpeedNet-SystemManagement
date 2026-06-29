import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useZones } from "@/hooks/useZones";
import type { User, Role } from "@/types";

const ROLES: Role[] = ["admin", "editor", "viewer", "agent"];

function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/users")).data,
  });
}

function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; full_name?: string; role: Role; zone_id?: number | null; password: string }) =>
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

const ROLE_COLORS: Record<Role, string> = {
  admin: "text-red",
  editor: "text-orange",
  viewer: "text-muted",
  agent: "text-cyan",
};

function AddUserModal({ onClose }: { onClose: () => void }) {
  const { data: zones } = useZones();
  const create = useCreateUser();
  const [form, setForm] = useState({ email: "", full_name: "", role: "viewer" as Role, zone_id: "", password: "" });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      email: form.email,
      full_name: form.full_name || undefined,
      role: form.role,
      zone_id: form.zone_id ? Number(form.zone_id) : null,
      password: form.password,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-8 w-full max-w-md">
        <h2 className="text-lg font-extrabold mb-6">Add User</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {(["email", "full_name", "password"] as const).map((k) => (
            <div key={k}>
              <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">{k.replace("_", " ")}</label>
              <input type={k === "password" ? "password" : k === "email" ? "email" : "text"}
                required={k !== "full_name"} value={form[k]} onChange={(e) => set(k, e.target.value)}
                className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue" />
            </div>
          ))}
          <div>
            <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">Role</label>
            <select value={form.role} onChange={(e) => set("role", e.target.value)}
              className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          {form.role === "agent" && (
            <div>
              <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">Zone</label>
              <select value={form.zone_id} onChange={(e) => set("zone_id", e.target.value)}
                className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue">
                <option value="">— none —</option>
                {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
          )}
          {create.error && <p className="text-red text-xs">{String(create.error)}</p>}
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-line text-muted text-sm hover:border-line2">Cancel</button>
            <button type="submit" disabled={create.isPending}
              className="flex-1 py-2 rounded-lg bg-blue text-white text-sm font-bold disabled:opacity-50">
              {create.isPending ? "Saving…" : "Create"}
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
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [showAdd, setShowAdd] = useState(false);

  const zoneName = (id: number | null) => zones?.find((z) => z.id === id)?.name ?? "—";

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center mb-8">
        <h1 className="text-2xl font-extrabold">Users</h1>
        <button onClick={() => setShowAdd(true)}
          className="ml-auto bg-blue text-white text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-blue/80">
          + Add User
        </button>
      </div>

      {isLoading ? (
        <div className="text-muted">Loading…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr>
                {["Email", "Name", "Role", "Zone", "Active", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] text-muted2 uppercase tracking-wide font-extrabold border-b border-line bg-panel2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-line/50 hover:bg-panel2/50">
                  <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{zoneName(u.zone_id ?? null)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateUser.mutate({ id: u.id, patch: { is_active: !u.is_active } })}
                      className={`text-xs font-bold ${u.is_active ? "text-green" : "text-red"} hover:underline`}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm(`Delete user ${u.email}?`)) deleteUser.mutate(u.id); }}
                      className="text-xs text-red hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
    </main>
  );
}
