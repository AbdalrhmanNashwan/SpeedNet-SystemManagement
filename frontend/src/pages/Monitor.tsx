import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMonitor } from "@/hooks/useMonitor";
import { SortableTh } from "@/components/SortableTh";
import { StatusDot } from "@/components/StatusDot";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useTableSort } from "@/hooks/useTableSort";
import { useT } from "@/i18n";
import type { MonitorRef, MonitorResult, PingStatus } from "@/types";

/** Pick the best link target for an IP: a focusable device on a tower, else its
 *  tower, else its IP-allocation row on the IP Allocations page. */
function towerLink(refs: MonitorRef[]): string | null {
  const dev = refs.find((r) => r.tower_id != null && r.type && r.type !== "ip_allocation" && r.device_id != null);
  if (dev) return `/tower/${dev.tower_id}?focus=${dev.type}:${dev.device_id}`;
  const tower = refs.find((r) => r.tower_id != null && (!r.type || r.type !== "ip_allocation"));
  if (tower) return `/tower/${tower.tower_id}`;
  const alloc = refs.find((r) => r.type === "ip_allocation" && r.device_id != null);
  if (alloc) return `/ip-allocations?focus=${alloc.device_id}`;
  return null;
}

type Filter = "all" | "up" | "down" | "unknown";

// down first, then unknown, then up — "sort by status" means surface problems.
const STATUS_RANK: Record<PingStatus, number> = { down: 0, unknown: 1, up: 2 };

// Module-level so the identity is stable across renders (see useTableSort).
const ACCESSORS = {
  status: (r: MonitorResult) => STATUS_RANK[r.status],
  ip: (r: MonitorResult) => r.ip,
  // Blank for online hosts, so compareCells parks them after the outages in
  // both directions: desc = most recently went offline, asc = down the longest.
  down_since: (r: MonitorResult) => r.down_since,
  latency_ms: (r: MonitorResult) => r.latency_ms,
  packet_loss: (r: MonitorResult) => (r.status === "up" ? r.packet_loss : null),
  sources: (r: MonitorResult) => r.sources.join(", "),
  last_checked: (r: MonitorResult) => r.last_checked,
};

/** How long an IP has been continuously offline, as a compact label. */
function downFor(iso: string | null, t: (s: string, v?: Record<string, string | number>) => string): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return t("{n}s", { n: s });
  if (s < 3600) return t("{n}m", { n: Math.round(s / 60) });
  if (s < 86400) return t("{n}h {m}m", { n: Math.floor(s / 3600), m: Math.round((s % 3600) / 60) });
  return t("{n}d {h}h", { n: Math.floor(s / 86400), h: Math.round((s % 86400) / 3600) });
}

function ago(iso: string | null, t: (s: string, v?: Record<string, string | number>) => string): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return t("{n}s ago", { n: s });
  if (s < 3600) return t("{n}m ago", { n: Math.round(s / 60) });
  return t("{n}h ago", { n: Math.round(s / 3600) });
}

function Stat({ label, value, cls }: { label: string; value: number | string; cls?: string }) {
  return (
    <div className="card px-5 py-3">
      <div className={`text-2xl font-extrabold ${cls ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted2 font-bold">{label}</div>
    </div>
  );
}

/** Live network monitor: every IP in the database with its real-time ping status. */
export default function Monitor() {
  const { data, isLoading, error } = useMonitor();
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let r = data?.results ?? [];
    if (filter !== "all") r = r.filter((x) => x.status === filter);
    const needle = q.trim().toLowerCase();
    if (needle) r = r.filter((x) =>
      x.ip.includes(needle) || x.sources.some((s) => s.toLowerCase().includes(needle)));
    return r;
  }, [data, filter, q]);

  // Defaults to problems-first; click "Down for" to rank by outage recency.
  const { sorted: rows, sort, toggle: toggleSort } = useTableSort(filtered, {
    initial: { key: "status", dir: "asc" },
    accessors: ACCESSORS,
  });

  const tabs: { key: Filter; label: string; cls?: string }[] = [
    { key: "all", label: t("All {n}", { n: data?.total ?? 0 }) },
    { key: "up", label: t("Online {n}", { n: data?.up ?? 0 }), cls: "text-green" },
    { key: "down", label: t("Offline {n}", { n: data?.down ?? 0 }), cls: "text-red" },
    { key: "unknown", label: t("Unknown {n}", { n: data?.unknown ?? 0 }), cls: "text-muted2" },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[{ label: t("Home"), to: "/", icon: "🏠" }, { label: t("Monitor"), icon: "📡" }]} />
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">📡</span>
        <div>
          <h1 className="text-2xl font-extrabold">{t("Network Monitor")}</h1>
          <p className="text-muted text-sm">
            {t("Live ICMP ping of every IP in the database")}
            {data?.sweep_completed_at && <> · {t("last sweep {ago}", { ago: ago(data.sweep_completed_at, t) })}</>}
            {data && !data.running && <span className="text-red"> · {t("monitor not running")}</span>}
          </p>
        </div>
      </div>

      {data?.error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red/40 bg-red/10 text-red text-sm">
          {t("Monitor error: {err}", { err: data.error })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label={t("Total IPs")} value={data?.total ?? 0} />
        <Stat label={t("Online")} value={data?.up ?? 0} cls="text-green" />
        <Stat label={t("Offline")} value={data?.down ?? 0} cls="text-red" />
        <Stat label={t("Unknown")} value={data?.unknown ?? 0} cls="text-muted2" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
              filter === t.key ? "border-blue bg-panel2" : "border-line text-muted hover:text-text"
            } ${t.cls ?? ""}`}>
            {t.label}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Filter by IP or source…")}
          className="sm:ms-auto bg-bg2 border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue w-full sm:w-56" />
      </div>

      {isLoading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : error ? (
        <div className="text-red">{t("Failed to load monitor status.")}</div>
      ) : rows.length === 0 ? (
        <div className="text-muted">{t("No IPs match.")}</div>
      ) : (
        <div className="border border-line rounded-[13px] overflow-auto max-h-[75vh]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {([
                  ["Status", "status"], ["IP", "ip"], ["Down for", "down_since"],
                  ["Latency", "latency_ms"], ["Loss", "packet_loss"],
                  ["Source", "sources"], ["Checked", "last_checked"],
                ] as const).map(([label, key]) => (
                  <SortableTh key={key} label={t(label)} sortKey={key}
                    sort={sort} onSort={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ip} className="border-b border-line/50">
                  <td className="px-3 py-2"><StatusDot status={r.status} withLabel ip={r.ip} /></td>
                  <td className="px-3 py-2 font-mono">
                    {(() => {
                      const to = towerLink(r.refs ?? []);
                      return to ? (
                        <Link to={to} className="text-cyan hover:underline inline-flex items-center gap-1" title="Open device's tower">
                          {r.ip}<span className="text-[10px] opacity-70">↗</span>
                        </Link>
                      ) : (
                        <span>{r.ip}</span>
                      );
                    })()}
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap ${r.down_since ? "text-red font-semibold" : "text-muted2"}`}
                      title={r.down_since ? new Date(r.down_since).toLocaleString() : undefined}>
                    {downFor(r.down_since, t)}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.latency_ms != null ? `${r.latency_ms} ms` : "—"}</td>
                  <td className="px-3 py-2 text-muted">{r.status === "up" ? `${Math.round(r.packet_loss * 100)}%` : "—"}</td>
                  <td className="px-3 py-2 text-muted2">{r.sources.join(", ")}</td>
                  <td className="px-3 py-2 text-muted2">{ago(r.last_checked, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
