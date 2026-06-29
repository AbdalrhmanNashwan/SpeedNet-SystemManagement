import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMonitor } from "@/hooks/useMonitor";
import { StatusDot } from "@/components/StatusDot";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { MonitorRef, PingStatus } from "@/types";

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

function ago(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
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
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    let r = data?.results ?? [];
    if (filter !== "all") r = r.filter((x) => x.status === filter);
    const needle = q.trim().toLowerCase();
    if (needle) r = r.filter((x) =>
      x.ip.includes(needle) || x.sources.some((s) => s.toLowerCase().includes(needle)));
    // down first, then unknown, then up — surface problems
    const rank: Record<PingStatus, number> = { down: 0, unknown: 1, up: 2 };
    return [...r].sort((a, b) => rank[a.status] - rank[b.status] || a.ip.localeCompare(b.ip));
  }, [data, filter, q]);

  const tabs: { key: Filter; label: string; cls?: string }[] = [
    { key: "all", label: `All ${data?.total ?? 0}` },
    { key: "up", label: `Online ${data?.up ?? 0}`, cls: "text-green" },
    { key: "down", label: `Offline ${data?.down ?? 0}`, cls: "text-red" },
    { key: "unknown", label: `Unknown ${data?.unknown ?? 0}`, cls: "text-muted2" },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[{ label: "Home", to: "/", icon: "🏠" }, { label: "Monitor", icon: "📡" }]} />
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">📡</span>
        <div>
          <h1 className="text-2xl font-extrabold">Network Monitor</h1>
          <p className="text-muted text-sm">
            Live ICMP ping of every IP in the database
            {data?.sweep_completed_at && <> · last sweep {ago(data.sweep_completed_at)}</>}
            {data && !data.running && <span className="text-red"> · monitor not running</span>}
          </p>
        </div>
      </div>

      {data?.error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red/40 bg-red/10 text-red text-sm">
          Monitor error: {data.error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Total IPs" value={data?.total ?? 0} />
        <Stat label="Online" value={data?.up ?? 0} cls="text-green" />
        <Stat label="Offline" value={data?.down ?? 0} cls="text-red" />
        <Stat label="Unknown" value={data?.unknown ?? 0} cls="text-muted2" />
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by IP or source…"
          className="sm:ml-auto bg-bg2 border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue w-full sm:w-56" />
      </div>

      {isLoading ? (
        <div className="text-muted">Loading…</div>
      ) : error ? (
        <div className="text-red">Failed to load monitor status.</div>
      ) : rows.length === 0 ? (
        <div className="text-muted">No IPs match.</div>
      ) : (
        <div className="border border-line rounded-[13px] overflow-auto max-h-[75vh]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {["Status", "IP", "Latency", "Loss", "Source", "Checked"].map((h) => (
                  <th key={h} className="sticky top-0 z-10 bg-panel text-left px-3 py-2 text-[9.5px] uppercase tracking-wide text-muted2 font-extrabold border-b border-line">{h}</th>
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
                  <td className="px-3 py-2 text-muted">{r.latency_ms != null ? `${r.latency_ms} ms` : "—"}</td>
                  <td className="px-3 py-2 text-muted">{r.status === "up" ? `${Math.round(r.packet_loss * 100)}%` : "—"}</td>
                  <td className="px-3 py-2 text-muted2">{r.sources.join(", ")}</td>
                  <td className="px-3 py-2 text-muted2">{ago(r.last_checked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
