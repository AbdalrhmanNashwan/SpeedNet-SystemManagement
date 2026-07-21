import { useState } from "react";
import { Link } from "react-router-dom";
import { useAudit } from "@/hooks/useAudit";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useT } from "@/i18n";
import type { AuditEntry } from "@/types";

const PAGE = 100;

// Device entities live on their tower's page and are deep-linked with
// ?focus=<type>:<id> (TowerDetail highlights + scrolls to the row).
const DEVICE_ENTITIES = new Set(["links", "switches", "sectors", "servers"]);

/** Read the tower id an entry's changes point at. `tower_id` is stored either
 *  as a plain value or, when it changed, as {from, to} — use the current (to)
 *  side so the link lands where the device is now. */
function towerIdOf(changes: Record<string, unknown> | null): number | null {
  const v = changes?.tower_id;
  if (v == null) return null;
  const raw = typeof v === "object" && v !== null && "to" in v
    ? (v as { to: unknown }).to : v;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Where "Open" should navigate for an audit entry, or null when there's
 *  nowhere to go — deletes (the thing is gone) and entries missing the ids we'd
 *  need to build a link. */
function targetFor(r: AuditEntry): string | null {
  if (r.action === "delete" || r.entity_id == null) return null;
  const id = r.entity_id;
  if (DEVICE_ENTITIES.has(r.entity)) {
    const tid = towerIdOf(r.changes);
    return tid != null ? `/tower/${tid}?focus=${r.entity}:${id}` : null;
  }
  switch (r.entity) {
    case "tower": return `/tower/${id}`;
    case "zone": return `/zone/${id}`;
    case "ip_allocation": return `/ip-allocations?focus=${id}`;
    case "user": return "/users";
    default: return null;
  }
}

const ACTION_STYLE: Record<string, string> = {
  create: "text-green border-green/40 bg-green/10",
  update: "text-blue border-blue/40 bg-blue/10",
  delete: "text-red border-red/40 bg-red/10",
  transfer: "text-purple border-purple/40 bg-purple/10",
  recompute: "text-yellow border-yellow/40 bg-yellow/10",
};

const ENTITIES = ["tower", "links", "switches", "sectors", "servers", "zone", "ip_allocation", "user"];
const ACTIONS = ["create", "update", "delete", "transfer", "recompute"];

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Changes({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes || Object.keys(changes).length === 0) return <span className="text-muted2">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(changes).map(([k, v]) => (
        <span key={k} className="text-[11px] font-mono bg-bg2 border border-line rounded px-1.5 py-0.5">
          <span className="text-muted2">{k}</span>
          <span className="text-muted">=</span>
          <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
        </span>
      ))}
    </div>
  );
}

/** Admin-only audit history: every create / edit / delete / transfer, newest first. */
export default function History() {
  const t = useT();
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filters = { entity, action, q, limit: PAGE, offset: page * PAGE };
  const { data, isLoading, isFetching } = useAudit(filters);
  const rows = data ?? [];

  const reset = (fn: () => void) => { fn(); setPage(0); };

  const selCls = "bg-bg2 border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue";

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[{ label: t("Home"), to: "/", icon: "🏠" }, { label: t("History"), icon: "📜" }]} />
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">📜</span>
        <div>
          <h1 className="text-2xl font-extrabold">{t("History")}</h1>
          <p className="text-muted text-sm">{t("Every change — who did what, and when")}{isFetching && t(" · refreshing…")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={action} onChange={(e) => reset(() => setAction(e.target.value))} className={selCls}>
          <option value="">{t("All actions")}</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{t(a)}</option>)}
        </select>
        <select value={entity} onChange={(e) => reset(() => setEntity(e.target.value))} className={selCls}>
          <option value="">{t("All types")}</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{t(e)}</option>)}
        </select>
        <input value={q} onChange={(e) => reset(() => setQ(e.target.value))} placeholder={t("Filter by user email…")}
          className={`${selCls} w-56`} />
        {(action || entity || q) && (
          <button onClick={() => reset(() => { setAction(""); setEntity(""); setQ(""); })}
            className="text-xs text-muted hover:text-text">{t("Clear")}</button>
        )}
        <div className="ms-auto flex items-center gap-2 text-sm">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-2 py-1 rounded border border-line disabled:opacity-40 hover:border-blue">{t("‹ Newer")}</button>
          <span className="text-muted2 text-xs">{t("page {n}", { n: page + 1 })}</span>
          <button disabled={rows.length < PAGE} onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 rounded border border-line disabled:opacity-40 hover:border-blue">{t("Older ›")}</button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : rows.length === 0 ? (
        <div className="text-muted">{t("No history entries match.")}</div>
      ) : (
        <div className="border border-line rounded-[13px] overflow-auto max-h-[75vh]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {["When", "User", "Action", "Type", "ID", "Details"].map((h) => (
                  <th key={h} className="sticky top-0 z-10 bg-panel text-start px-3 py-2 text-[9.5px] uppercase tracking-wide text-muted2 font-extrabold border-b border-line">{t(h)}</th>
                ))}
                <th className="sticky top-0 end-0 z-20 bg-panel px-3 py-2 border-b border-s border-line" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r: AuditEntry) => {
                const target = targetFor(r);
                return (
                <tr key={r.id} className="border-b border-line/50 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted2">{when(r.created_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.user_email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${ACTION_STYLE[r.action] ?? "text-muted border-line"}`}>
                      {t(r.action)}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{t(r.entity)}</td>
                  <td className="px-3 py-2 text-muted2">{r.entity_id ?? "—"}</td>
                  <td className="px-3 py-2"><Changes changes={r.changes} /></td>
                  <td className="sticky end-0 z-10 bg-bg border-s border-line/50 px-3 py-2 text-end whitespace-nowrap">
                    {target && (
                      <Link
                        to={target}
                        className="inline-flex items-center gap-1 text-xs font-bold text-cyan hover:underline"
                        title={t("Open")}
                      >
                        {t("Open")}<span className="rtl:rotate-180" aria-hidden>↗</span>
                      </Link>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
