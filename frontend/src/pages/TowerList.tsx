import { useState } from "react";
import { Link } from "react-router-dom";
import { useTowers, useCreateTower, useDeleteTower, useAssignZone } from "@/hooks/useTowers";
import { useZones } from "@/hooks/useZones";
import { TowerCard } from "@/components/TowerCard";
import { usePerms } from "@/hooks/usePerms";
import { STATUS_OPTIONS as STATUSES } from "@/lib/fieldOptions";
import { useT } from "@/i18n";
import type { Tower } from "@/types";

function AddTowerModal({ onClose }: { onClose: () => void }) {
  const create = useCreateTower();
  const t = useT();
  const { data: zones } = useZones();
  const [form, setForm] = useState<Partial<Tower>>({ status: "Active" });

  const set = (k: keyof Tower, v: string | number | null) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync(form as Omit<Tower, "id">);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-8 w-full max-w-lg">
        <h2 className="text-lg font-extrabold mb-6">{t("Add Tower")}</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label={t("Name *")} required value={form.name ?? ""} onChange={(v) => set("name", v)} />
          <Field label={t("Area")} value={form.area ?? ""} onChange={(v) => set("area", v)} />
          <Field label={t("Agent")} value={form.agent ?? ""} onChange={(v) => set("agent", v)} />
          <div>
            <label className="label">{t("Status")}</label>
            <select value={form.status ?? "Active"} onChange={(e) => set("status", e.target.value)}
              className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("Zone")}</label>
            <select value={form.zone_id ?? ""} onChange={(e) => set("zone_id", e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue">
              <option value="">{t("— none —")}</option>
              {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-line text-muted text-sm hover:border-line2">{t("Cancel")}</button>
            <button type="submit" disabled={create.isPending} className="flex-1 py-2 rounded-lg bg-blue text-white text-sm font-bold disabled:opacity-50">
              {create.isPending ? t("Saving…") : t("Create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">{label}</label>
      <input required={required} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue" />
    </div>
  );
}

export default function TowerList() {
  const { user, isAgent, canCreate, canUpdate, canDelete } = usePerms();
  const t = useT();
  const [filter, setFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assignZone, setAssignZone] = useState<number | "" | "none">("");
  const deleteTower = useDeleteTower();
  const assign = useAssignZone();

  const { data: zones } = useZones();
  // agents are locked to their own zone; others use the chosen filter
  const effectiveZone = isAgent ? user?.zone_id ?? undefined : (zoneFilter || undefined);
  const { data: towers, isLoading } = useTowers(
    effectiveZone ? { zone_id: effectiveZone } : undefined
  );

  // Moving towers between zones is a company-wide action → non-agent updaters only.
  const canBulkAssign = canUpdate && !isAgent;

  const filtered = towers?.filter((t) => {
    const q = filter.toLowerCase();
    const matchName = !q || t.name.toLowerCase().includes(q) || (t.area ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchName && matchStatus;
  });

  // group by zone
  const byZone: Record<string, typeof filtered> = {};
  filtered?.forEach((t) => {
    const zName = zones?.find((z) => z.id === t.zone_id)?.name ?? "No Zone";
    (byZone[zName] ??= []).push(t);
  });

  // ---- multi-select → assign to zone ----
  const toggleSel = (id: number) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());
  const selectAllShown = () => setSelected(new Set((filtered ?? []).map((t) => t.id)));
  const doAssign = async () => {
    if (assignZone === "" || selected.size === 0) return;
    const zone_id = assignZone === "none" ? null : Number(assignZone);
    await assign.mutateAsync({ ids: [...selected], zone_id });
    clearSel();
    setAssignZone("");
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <h1 className="text-2xl font-extrabold">{t("Towers")}</h1>
        <div className="ms-auto flex gap-2 flex-wrap">
          <input value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder={t("Filter by name or area…")}
            className="bg-bg2 border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue w-52" />
          {!isAgent && (
            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value ? Number(e.target.value) : "")}
              className="bg-bg2 border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue">
              <option value="">{t("All zones")}</option>
              {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          )}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-bg2 border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue">
            <option value="">{t("All statuses")}</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          {canCreate && (
            <button onClick={() => setShowAdd(true)}
              className="bg-blue text-white text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-blue/80">
              {t("+ Add Tower")}
            </button>
          )}
        </div>
      </div>

      {canBulkAssign && (
        <div className="flex items-center gap-3 mb-5 px-4 py-2.5 rounded-xl bg-panel2 border border-line text-sm flex-wrap">
          {selected.size === 0 ? (
            <span className="text-muted2 text-xs">
              {t("Tip: tick towers to move them into a zone.")}
              <button onClick={selectAllShown} className="ms-2 text-cyan hover:underline">{t("Select all shown")}</button>
            </span>
          ) : (
            <>
              <span className="font-bold">{t("{n} selected", { n: selected.size })}</span>
              <button onClick={selectAllShown} className="text-cyan text-xs hover:underline">{t("Select all shown")}</button>
              <span className="text-muted2 ms-2 text-xs">{t("Move to zone:")}</span>
              <select value={assignZone}
                onChange={(e) => {
                  const v = e.target.value;
                  setAssignZone(v === "" ? "" : v === "none" ? "none" : Number(v));
                }}
                className="bg-bg2 border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue">
                <option value="">{t("— choose zone —")}</option>
                <option value="none">{t("No Zone (unassign)")}</option>
                {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <button onClick={doAssign} disabled={assignZone === "" || assign.isPending}
                className="bg-blue text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-blue/80">
                {assign.isPending ? t("Moving…") : t("Assign")}
              </button>
              <button onClick={clearSel} className="text-muted hover:text-text text-xs ms-auto">{t("Clear")}</button>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : (
        Object.entries(byZone).sort(([a], [b]) => a.localeCompare(b)).map(([zoneName, tws]) => (
          <section key={zoneName} className="mb-10">
            <h2 className="text-xs text-muted2 uppercase tracking-widest font-extrabold mb-3">{t(zoneName)} ({tws?.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {tws?.map((tw) => {
                const sel = selected.has(tw.id);
                return (
                  <div
                    key={tw.id}
                    className={`relative group rounded-[18px] transition-all ${
                      sel ? "ring-2 ring-cyan ring-offset-2 ring-offset-bg" : ""
                    }`}
                  >
                    <TowerCard tower={tw} />
                    {canBulkAssign && (
                      <button
                        type="button"
                        onClick={() => toggleSel(tw.id)}
                        aria-pressed={sel}
                        aria-label={t("Select")}
                        title={t("Select")}
                        className={`absolute top-2.5 start-2.5 w-5 h-5 rounded-md border flex items-center justify-center z-10 transition-all ${
                          sel
                            ? "bg-cyan border-cyan text-bg"
                            : "bg-panel/80 border-line2 text-transparent backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:border-cyan"
                        }`}
                      >
                        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M3 8.5l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => { if (confirm(t('Delete tower "{name}"?', { name: tw.name }))) deleteTower.mutate(tw.id); }}
                        aria-label={t("Delete tower")}
                        title={t("Delete tower")}
                        className="absolute top-2.5 end-2.5 w-6 h-6 rounded-md flex items-center justify-center bg-panel/80 border border-line2 text-muted2 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:text-red hover:border-red/50 z-10 transition-all"
                      >
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {showAdd && <AddTowerModal onClose={() => setShowAdd(false)} />}
    </main>
  );
}
