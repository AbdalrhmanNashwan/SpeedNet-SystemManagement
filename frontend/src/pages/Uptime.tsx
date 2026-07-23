import { useState } from "react";
import { Link } from "react-router-dom";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SortableTh } from "@/components/SortableTh";
import { useTableSort } from "@/hooks/useTableSort";
import { useUptime, useOutages, type UptimeItem, type OutageItem } from "@/hooks/useUptime";
import { useT } from "@/i18n";

type TFn = (s: string, v?: Record<string, string | number>) => string;

/** Compact duration: 2d 3h / 4h 12m / 7m 30s / 45s. */
function dur(seconds: number, t: TFn): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return t("{n}s", { n: s });
  if (s < 3600) return t("{n}m {s}s", { n: Math.floor(s / 60), s: s % 60 });
  if (s < 86400) return t("{n}h {m}m", { n: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) });
  return t("{n}d {h}h", { n: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600) });
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

/** Colour the SLA figure by how bad it is — 99.9% and 82% shouldn't look alike. */
function pctClass(p: number): string {
  if (p >= 99.9) return "text-green";
  if (p >= 99) return "text-text";
  if (p >= 95) return "text-yellow";
  return "text-red";
}

function towerLink(towerId: number | null, name: string | null, t: TFn) {
  if (towerId == null) return <span className="text-muted2">{name ?? t("—")}</span>;
  return (
    <Link to={`/tower/${towerId}`} className="text-cyan hover:underline">
      {name ?? t("Tower #{id}", { id: towerId })}
    </Link>
  );
}

const UPTIME_ACCESSORS = {
  ip: (r: UptimeItem) => r.ip,
  tower_name: (r: UptimeItem) => r.tower_name,
  outages: (r: UptimeItem) => r.outages,
  downtime_seconds: (r: UptimeItem) => r.downtime_seconds,
  uptime_pct: (r: UptimeItem) => r.uptime_pct,
  last_outage_at: (r: UptimeItem) => r.last_outage_at,
};

const OUTAGE_ACCESSORS = {
  ip: (r: OutageItem) => r.ip,
  tower_name: (r: OutageItem) => r.tower_name,
  started_at: (r: OutageItem) => r.started_at,
  ended_at: (r: OutageItem) => r.ended_at,
  duration_seconds: (r: OutageItem) => r.duration_seconds,
};

const RANGES = [7, 30, 90] as const;

/** Uptime / downtime reporting from the durable outage history. */
export default function Uptime() {
  const t = useT();
  const [days, setDays] = useState<number>(30);
  const { data: up, isLoading: loadingUp } = useUptime(days);
  const { data: out, isLoading: loadingOut } = useOutages(days);
  const [tab, setTab] = useState<"summary" | "events">("summary");

  const summary = useTableSort(up?.items ?? [], {
    initial: { key: "downtime_seconds", dir: "desc" },
    accessors: UPTIME_ACCESSORS,
  });
  const events = useTableSort(out?.outages ?? [], {
    initial: { key: "started_at", dir: "desc" },
    accessors: OUTAGE_ACCESSORS,
  });

  const totalDown = (up?.items ?? []).reduce((n, i) => n + i.downtime_seconds, 0);
  const ongoing = (up?.items ?? []).filter((i) => i.ongoing).length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[{ label: t("Home"), to: "/", icon: "🏠" }, { label: t("Uptime"), icon: "📈" }]} />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-4xl">📈</span>
        <div>
          <h1 className="text-2xl font-extrabold">{t("Uptime & Outages")}</h1>
          <p className="text-muted text-sm">
            {t("Recorded outage history — survives restarts, unlike the live monitor.")}
          </p>
        </div>
        <div className="ms-auto flex gap-2">
          {RANGES.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                days === d ? "border-blue bg-panel2 text-text" : "border-line text-muted hover:text-text"
              }`}>
              {t("{n}d", { n: d })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card px-5 py-3">
          <div className="text-2xl font-extrabold">{up?.items.length ?? 0}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted2 font-bold">{t("IPs with outages")}</div>
        </div>
        <div className="card px-5 py-3">
          <div className="text-2xl font-extrabold">{out?.outages.length ?? 0}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted2 font-bold">{t("Outages recorded")}</div>
        </div>
        <div className="card px-5 py-3">
          <div className="text-2xl font-extrabold">{dur(totalDown, t)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted2 font-bold">{t("Total downtime")}</div>
        </div>
        <div className="card px-5 py-3">
          <div className={`text-2xl font-extrabold ${ongoing ? "text-red" : "text-green"}`}>{ongoing}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted2 font-bold">{t("Still down")}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {([["summary", t("By IP")], ["events", t("Every outage")]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
              tab === k ? "border-blue bg-panel2 text-text" : "border-line text-muted hover:text-text"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        loadingUp ? <div className="text-muted">{t("Loading…")}</div>
        : summary.sorted.length === 0 ? (
          <div className="card p-10 text-center text-muted2">
            {t("No outages recorded in this period. Everything has been up.")}
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
                      sort={summary.sort} onSort={summary.toggle} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.sorted.map((r) => (
                  <tr key={r.ip} className="border-b border-line/50">
                    <td className="px-3 py-2 font-mono">
                      {r.ip}
                      {r.ongoing && (
                        <span className="ms-2 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red/15 text-red">
                          {t("down now")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{towerLink(r.tower_id, r.tower_name, t)}</td>
                    <td className={`px-3 py-2 font-mono font-bold ${pctClass(r.uptime_pct)}`}>
                      {r.uptime_pct.toFixed(3)}%
                    </td>
                    <td className="px-3 py-2 text-muted whitespace-nowrap">{dur(r.downtime_seconds, t)}</td>
                    <td className="px-3 py-2 text-muted2">{r.outages}</td>
                    <td className="px-3 py-2 text-muted2 whitespace-nowrap">{when(r.last_outage_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        loadingOut ? <div className="text-muted">{t("Loading…")}</div>
        : events.sorted.length === 0 ? (
          <div className="card p-10 text-center text-muted2">
            {t("No outages recorded in this period. Everything has been up.")}
          </div>
        ) : (
          <div className="border border-line rounded-[13px] overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  {([["IP", "ip"], ["Tower", "tower_name"], ["Went down", "started_at"],
                     ["Came back", "ended_at"], ["Duration", "duration_seconds"]] as const).map(([label, key]) => (
                    <SortableTh key={key} label={t(label)} sortKey={key}
                      sort={events.sort} onSort={events.toggle} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.sorted.map((o) => (
                  <tr key={o.id} className="border-b border-line/50">
                    <td className="px-3 py-2 font-mono">{o.ip}</td>
                    <td className="px-3 py-2">{towerLink(o.tower_id, o.tower_name, t)}</td>
                    <td className="px-3 py-2 text-muted2 whitespace-nowrap">{when(o.started_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {o.ongoing
                        ? <span className="text-red font-bold">{t("still down")}</span>
                        : <span className="text-muted2">{when(o.ended_at)}</span>}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${o.ongoing ? "text-red font-semibold" : "text-muted"}`}>
                      {dur(o.duration_seconds, t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </main>
  );
}
