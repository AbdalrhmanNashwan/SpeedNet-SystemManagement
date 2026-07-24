import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SortableTh } from "@/components/SortableTh";
import { useTableSort } from "@/hooks/useTableSort";
import { useMonitor } from "@/hooks/useMonitor";
import { useUptime, type UptimeItem } from "@/hooks/useUptime";
import { useT } from "@/i18n";

type TFn = (s: string, v?: Record<string, string | number>) => string;

/** Compact duration: 45s / 12m / 3h 20m / 2d 4h. */
function dur(seconds: number, t: TFn): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return t("{n}s", { n: s });
  if (s < 3600) return t("{n}m", { n: Math.round(s / 60) });
  if (s < 86400) return t("{n}h {m}m", { n: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) });
  return t("{n}d {h}h", { n: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600) });
}

function when(iso: string | null, t: TFn): string {
  if (!iso) return "—";
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 1) return t("just now");
  if (mins < 60) return t("{n}m ago", { n: Math.floor(mins) });
  if (mins < 1440) return t("{n}h ago", { n: Math.floor(mins / 60) });
  return new Date(iso).toLocaleDateString();
}

/** availability tint: 99.9 green, 99 text, 95 amber, below that red */
function pctTone(p: number) {
  if (p >= 99.9) return { text: "text-green", bar: "var(--green,#34d399)" };
  if (p >= 99) return { text: "text-text", bar: "var(--cyan,#22d3ee)" };
  if (p >= 95) return { text: "text-amber", bar: "var(--amber,#fbbf24)" };
  return { text: "text-red", bar: "var(--red,#fb7185)" };
}

function towerLink(id: number | null, name: string | null, t: TFn) {
  if (id == null) return <span className="text-muted2">{name ?? t("Unassigned")}</span>;
  return <Link to={`/tower/${id}`} className="text-cyan hover:underline">{name ?? t("Tower #{id}", { id })}</Link>;
}

/** Thin uptime bar — green fill = uptime, red remainder = downtime. */
function UptimeBar({ pct }: { pct: number }) {
  const tone = pctTone(pct);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-24 rounded-full bg-red/25 overflow-hidden">
        <div className="absolute inset-y-0 start-0 rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: tone.bar }} />
      </div>
      <span className={`font-mono text-[11.5px] font-semibold tabular-nums ${tone.text}`}>
        {pct.toFixed(pct >= 99.9 ? 3 : pct >= 95 ? 2 : 1)}%
      </span>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card px-5 py-4">
      <div className={`text-[26px] leading-none font-semibold ${tone ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted2 font-semibold mt-2">{label}</div>
      {sub && <div className="text-[11px] text-muted mt-1">{sub}</div>}
    </div>
  );
}

const ACCESSORS = {
  ip: (r: UptimeItem) => r.ip,
  tower_name: (r: UptimeItem) => r.tower_name,
  uptime_pct: (r: UptimeItem) => r.uptime_pct,
  downtime_seconds: (r: UptimeItem) => r.downtime_seconds,
  outages: (r: UptimeItem) => r.outages,
  last_outage_at: (r: UptimeItem) => r.last_outage_at,
};

const RANGES = [1, 7, 30] as const;

/** Uptime & outage reporting, from the durable outage history. */
export default function Uptime() {
  const t = useT();
  const [days, setDays] = useState<number>(1);
  const { data, isLoading } = useUptime(days);
  const monitor = useMonitor();

  const items = data?.items ?? [];
  const window = data?.window_seconds ?? days * 86400;
  const fleet = monitor.data?.total ?? 0;

  const totalDown = items.reduce((n, i) => n + i.downtime_seconds, 0);
  const totalOutages = items.reduce((n, i) => n + i.outages, 0);
  const ongoing = items.filter((i) => i.ongoing);

  // Fleet availability: total observed downtime over (window × every monitored
  // IP). Falls back to the mean of affected IPs if the fleet size hasn't loaded.
  const availability = useMemo(() => {
    if (fleet > 0 && window > 0) return Math.max(0, 100 * (1 - totalDown / (window * fleet)));
    if (items.length === 0) return 100;
    return items.reduce((n, i) => n + i.uptime_pct, 0) / items.length;
  }, [fleet, window, totalDown, items]);

  // Currently-down IPs grouped by tower — one problem per tower, not per device.
  const downByTower = useMemo(() => {
    const m = new Map<string, { id: number | null; name: string | null; count: number; longest: number }>();
    for (const i of ongoing) {
      const key = i.tower_id != null ? `t${i.tower_id}` : `n:${i.tower_name ?? ""}`;
      const g = m.get(key) ?? { id: i.tower_id, name: i.tower_name, count: 0, longest: 0 };
      g.count += 1;
      g.longest = Math.max(g.longest, i.downtime_seconds);
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.count - a.count || b.longest - a.longest);
  }, [ongoing]);

  const table = useTableSort(items, {
    initial: { key: "downtime_seconds", dir: "desc" },
    accessors: ACCESSORS,
  });

  const avTone = pctTone(availability);
  const sinceLabel = data ? new Date(data.monitoring_since).toLocaleString() : "";

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[{ label: t("Home"), to: "/", icon: "🏠" }, { label: t("Uptime"), icon: "📈" }]} />

      <div className="flex items-start gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{t("Uptime & Outages")}</h1>
          <p className="text-muted text-sm mt-1">
            {data?.partial_window
              ? t("Only {w} of history so far · monitoring since {since}",
                  { w: dur(window, t), since: sinceLabel })
              : t("Measured over the last {w}", { w: dur(window, t) })}
          </p>
        </div>
        <div className="ms-auto inline-flex rounded-lg border border-line overflow-hidden">
          {RANGES.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs font-semibold px-3.5 py-1.5 ${
                days === d ? "bg-panel2 text-text" : "text-muted hover:text-text"
              } ${d !== RANGES[0] ? "border-s border-line" : ""}`}>
              {d === 1 ? t("24h") : t("{n}d", { n: d })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi label={t("Availability")} value={`${availability.toFixed(availability >= 99.9 ? 3 : 2)}%`}
          tone={avTone.text} sub={fleet ? t("across {n} IPs", { n: fleet }) : undefined} />
        <Kpi label={t("Down right now")} value={String(ongoing.length)}
          tone={ongoing.length ? "text-red" : "text-green"}
          sub={ongoing.length ? t("on {n} towers", { n: downByTower.length }) : t("all clear")} />
        <Kpi label={t("Outages")} value={String(totalOutages)} sub={t("in this period")} />
        <Kpi label={t("Total downtime")} value={dur(totalDown, t)} sub={t("summed across all IPs")} />
      </div>

      {/* Currently down — the actionable part, grouped so a tower with 20 dead
          devices reads as one problem, not twenty. */}
      {ongoing.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
            <h2 className="text-sm font-semibold">{t("Currently down")}</h2>
            <span className="text-xs text-muted2">{t("{n} IPs on {t} towers", { n: ongoing.length, t: downByTower.length })}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {downByTower.map((g, i) => (
              <div key={i} className="card px-4 py-3 flex items-center gap-3 border-s-2 border-s-red">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{towerLink(g.id, g.name, t)}</div>
                  <div className="text-[11px] text-muted2 mt-0.5">
                    {t("longest down {d}", { d: dur(g.longest, t) })}
                  </div>
                </div>
                <div className="text-lg font-semibold text-red tabular-nums shrink-0">{g.count}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full per-IP breakdown */}
      <h2 className="text-sm font-semibold mb-3">{t("By device")}</h2>
      {isLoading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-2">✓</div>
          <div className="text-muted">{t("No outages recorded in this period. Everything has been up.")}</div>
        </div>
      ) : (
        <div className="border border-line rounded-[13px] overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {([["IP", "ip"], ["Tower", "tower_name"], ["Uptime", "uptime_pct"],
                   ["Downtime", "downtime_seconds"], ["Outages", "outages"],
                   ["Last outage", "last_outage_at"]] as const).map(([label, key]) => (
                  <SortableTh key={key} label={t(label)} sortKey={key}
                    sort={table.sort} onSort={table.toggle} />
                ))}
              </tr>
            </thead>
            <tbody>
              {table.sorted.map((r) => (
                <tr key={r.ip} className="border-b border-line/50 hover:bg-panel2/40">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    {r.ongoing && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red me-2 align-middle" />}
                    {r.ip}
                  </td>
                  <td className="px-3 py-2">
                    {towerLink(r.tower_id, r.tower_name, t)}
                    {r.label && <span className="text-muted2 text-[11px] ms-1.5">· {r.label}</span>}
                  </td>
                  <td className="px-3 py-2"><UptimeBar pct={r.uptime_pct} /></td>
                  <td className={`px-3 py-2 whitespace-nowrap ${r.ongoing ? "text-red" : "text-muted"}`}>
                    {dur(r.downtime_seconds, t)}
                  </td>
                  <td className="px-3 py-2 text-muted2">{r.outages}</td>
                  <td className="px-3 py-2 text-muted2 whitespace-nowrap">{when(r.last_outage_at, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
