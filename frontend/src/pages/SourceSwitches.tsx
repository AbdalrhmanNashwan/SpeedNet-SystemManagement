import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTowers } from "@/hooks/useTowers";
import { Icon } from "@/components/Icon";
import { useT } from "@/i18n";
import type { Tower } from "@/types";

/* Source switches — every tower grouped by the switch that feeds it (fed_by).
 * A NOC-style master/detail: pick a switch on the left, see what it feeds (and
 * what's down) on the right. Switches with outages sort to the top. */

const isDown = (s?: string | null) => /down|inactive|cancel/i.test(s ?? "");
const dotColor = (s?: string | null) =>
  isDown(s) ? "bg-red" : /active|done/i.test(s ?? "") ? "bg-green" : "bg-muted2";

interface Group { sw: string; model: string; towers: Tower[]; down: number; }

/** Small up/down donut for a switch's health. */
function Donut({ up, down, size = 60 }: { up: number; down: number; size?: number }) {
  const total = up + down || 1;
  const r = (size - 9) / 2;
  const c = 2 * Math.PI * r;
  const downLen = (down / total) * c;
  const stroke = 6;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--green)" strokeWidth={stroke}
        opacity={down === total ? 0.15 : 1} />
      {down > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--red)" strokeWidth={stroke}
          strokeDasharray={`${downLen} ${c - downLen}`} strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function SourceSwitches() {
  const t = useT();
  const nav = useNavigate();
  const { data: towers, isLoading } = useTowers();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const all = useMemo<Group[]>(() => {
    const m = new Map<string, Tower[]>();
    for (const tw of towers ?? []) {
      const key = (tw.fed_by ?? "").trim();
      if (!key) continue;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(tw);
    }
    return [...m.entries()].map(([sw, ts]) => ({
      sw,
      model: ts.map((x) => x.feed_model).find(Boolean) ?? "",
      towers: [...ts].sort((a, b) =>
        (isDown(b.status) ? 1 : 0) - (isDown(a.status) ? 1 : 0) || a.name.localeCompare(b.name)),
      down: ts.filter((x) => isDown(x.status)).length,
    }));
  }, [towers]);

  const groups = useMemo(() => {
    const lq = q.trim().toLowerCase();
    const filtered = !lq ? all : all.filter(
      (g) => g.sw.toLowerCase().includes(lq) || g.towers.some((tw) => tw.name.toLowerCase().includes(lq)),
    );
    return [...filtered].sort((a, b) => b.down - a.down || b.towers.length - a.towers.length || a.sw.localeCompare(b.sw));
  }, [all, q]);

  const active = groups.find((g) => g.sw === sel) ?? groups[0];
  const mapped = all.reduce((n, g) => n + g.towers.length, 0);
  const downTotal = all.reduce((n, g) => n + g.down, 0);
  const affectedSwitches = all.filter((g) => g.down > 0).length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* header + inline summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
        <div className="flex items-center gap-3">
          <Icon name="switches" className="w-6 h-6 text-cyan" />
          <h1 className="text-2xl font-extrabold">{t("Source switches")}</h1>
        </div>
        <div className="ms-auto flex items-center gap-5 font-mono text-sm">
          <span><b className="text-text">{all.length}</b> <span className="text-muted2">{t("switches")}</span></span>
          <span><b className="text-text">{mapped}</b> <span className="text-muted2">{t("towers")}</span></span>
          <span className={downTotal ? "text-red" : "text-green"}>
            <b>{downTotal}</b> <span className="opacity-80">{t("down")}</span>
          </span>
        </div>
      </div>
      <p className="text-muted text-sm mb-5">
        {t("Every tower grouped by the switch that feeds it. If a switch fails, everything under it goes down.")}
      </p>

      {/* outage banner — most-affected switch */}
      {downTotal > 0 && groups[0]?.down > 0 && (
        <button onClick={() => setSel(groups[0].sw)}
          className="w-full mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-red/40 bg-red/10 text-start hover:bg-red/15 transition-colors">
          <span className="w-2 h-2 rounded-full bg-red animate-pulse shrink-0" />
          <span className="text-sm">
            <b className="font-mono">{groups[0].sw}</b> {t("has")} <b className="text-red">{groups[0].down}</b> {t("towers down")}
          </span>
          <span className="ms-auto text-xs text-muted2 shrink-0">
            {affectedSwitches} {t("switch(es) affected")} →
          </span>
        </button>
      )}

      {isLoading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : all.length === 0 ? (
        <div className="card p-10 text-center text-muted2">
          {t("No source switches yet. Fill the Service source on a tower to see it here.")}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,320px)_1fr] gap-5 items-start">
          {/* LEFT — switch list */}
          <div className="flex flex-col gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Filter switches or towers…")}
              className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan"
            />
            <div className="card p-1.5 lg:max-h-[68vh] lg:overflow-y-auto flex flex-col gap-0.5">
              {groups.length === 0 ? (
                <div className="text-muted2 text-sm p-4 text-center">{t('Nothing matches "{q}".', { q })}</div>
              ) : groups.map((g) => {
                const on = active?.sw === g.sw;
                return (
                  <button key={g.sw} onClick={() => setSel(g.sw)}
                    className={`text-start px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-colors ${
                      on ? "bg-cyan/10" : "hover:bg-panel2"}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${g.down ? "bg-red" : "bg-green"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-semibold text-[13.5px] truncate">{g.sw}</div>
                      <div className="text-[11px] text-muted2">{g.towers.length} {t("towers")}</div>
                    </div>
                    {g.down > 0 && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-red/15 text-red shrink-0">{g.down}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT — detail */}
          {active && (
            <div className="card p-6">
              {/* header */}
              <div className="flex items-center gap-4 pb-5 mb-5 border-b border-line">
                <Donut up={active.towers.length - active.down} down={active.down} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono font-bold text-lg text-text truncate">{active.sw}</h2>
                    {active.model && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-line2 text-muted2">{active.model}</span>}
                  </div>
                  <div className="text-sm text-muted mt-0.5">
                    {t("feeds")} <b className="text-text">{active.towers.length}</b> {t("towers")}
                    {active.down > 0
                      ? <> · <span className="text-red font-semibold">{active.down} {t("down")}</span></>
                      : <> · <span className="text-green font-semibold">{t("all up")}</span></>}
                  </div>
                </div>
              </div>

              {/* tower list (down first) */}
              <div className="flex flex-col gap-0.5">
                {active.towers.map((tw) => (
                  <button key={tw.id} onClick={() => nav(`/tower/${tw.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-panel2 text-start group">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor(tw.status)}`} />
                    <span className={`text-[14px] truncate ${isDown(tw.status) ? "text-red font-medium" : ""}`}>{tw.name}</span>
                    <span className="ms-auto flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-muted2">
                        {[tw.feed_port, tw.feed_mode].filter(Boolean).join(" · ")}
                      </span>
                      <span className="text-muted2 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
