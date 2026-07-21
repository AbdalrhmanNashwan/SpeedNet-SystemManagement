import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useTowers } from "@/hooks/useTowers";
import { useMonitor } from "@/hooks/useMonitor";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useT } from "@/i18n";
import type { Tower } from "@/types";

// Fallback view when nothing is mapped yet: roughly centered on Iraq.
const FALLBACK_CENTER: [number, number] = [34.5, 43.5];
const FALLBACK_ZOOM = 6;

/**
 * A tower's map color reflects how many of ITS monitored IPs are up vs down,
 * not a single IP:
 *   up      → every IP online              (green)
 *   partial → some offline, but ≤ half     (yellow)
 *   major   → most IPs offline (> half)    (red)
 *   down    → every IP offline             (dark red)
 *   unknown → nothing being pinged yet     (gray)
 */
type TowerHealth = "up" | "partial" | "major" | "down" | "unknown";

const STATUS_COLOR: Record<TowerHealth, string> = {
  up: "#22c55e",
  partial: "#eab308",
  major: "#ef4444",
  down: "#7f1d1d",
  unknown: "#9ca3af",
};

const HEALTH_LABEL: Record<TowerHealth, string> = {
  up: "Online",
  partial: "Partly offline",
  major: "Mostly offline",
  down: "Offline",
  unknown: "Unknown",
};

/** Bucket a tower into a health level from its up/down IP counts. */
function health(up: number, down: number): TowerHealth {
  const total = up + down;
  if (total === 0) return "unknown";
  if (down === 0) return "up";       // all online
  if (up === 0) return "down";       // all offline
  return down > up ? "major" : "partial"; // most-offline vs partial outage
}

interface Placed extends Tower {
  lat: number;
  lng: number;
  live: TowerHealth;
}

/** Parse a coordinate string to a finite number, or null if blank/invalid. */
function num(v: string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** A lat/lng pair is only usable if both parse and fall in valid earth ranges. */
function coords(t: Tower): { lat: number; lng: number } | null {
  const lat = num(t.gps_lat);
  const lng = num(t.gps_lng);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null; // null-island placeholder
  return { lat, lng };
}

function digits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** Live network map: every tower with valid GPS, colored by its ping status. */
export default function TowersMap() {
  const { data: towers, isLoading, error } = useTowers();
  const { data: monitor } = useMonitor();
  const t = useT();

  // tower_id -> {up, down} counts across all IPs referencing that tower, then
  // bucketed into a health level. Each IP counts once per tower (a shared IP
  // referenced twice on the same tower isn't double-weighted); non-definite
  // (unknown) IP results are ignored so they don't skew the ratio.
  const towerStatus = useMemo(() => {
    const agg = new Map<number, { up: number; down: number }>();
    for (const r of monitor?.results ?? []) {
      if (r.status !== "up" && r.status !== "down") continue;
      const towers = new Set<number>();
      for (const ref of r.refs ?? []) {
        if (ref.tower_id != null) towers.add(ref.tower_id);
      }
      for (const tid of towers) {
        const c = agg.get(tid) ?? { up: 0, down: 0 };
        if (r.status === "up") c.up++;
        else c.down++;
        agg.set(tid, c);
      }
    }
    const m = new Map<number, TowerHealth>();
    for (const [tid, c] of agg) m.set(tid, health(c.up, c.down));
    return m;
  }, [monitor]);

  const placed = useMemo<Placed[]>(() => {
    const out: Placed[] = [];
    for (const tw of towers ?? []) {
      const c = coords(tw);
      if (!c) continue;
      out.push({ ...tw, lat: c.lat, lng: c.lng, live: towerStatus.get(tw.id) ?? "unknown" });
    }
    return out;
  }, [towers, towerStatus]);

  // Parent links to draw as topology lines (both endpoints must be placed).
  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);
  const edges = useMemo(() => {
    const lines: { a: Placed; b: Placed }[] = [];
    for (const p of placed) {
      if (p.parent_id == null) continue;
      const parent = byId.get(p.parent_id);
      if (parent) lines.push({ a: p, b: parent });
    }
    return lines;
  }, [placed, byId]);

  const bounds = useMemo(
    () => (placed.length ? placed.map((p) => [p.lat, p.lng] as [number, number]) : null),
    [placed],
  );

  const counts = useMemo(() => {
    const c = { up: 0, partial: 0, major: 0, down: 0, unknown: 0 };
    for (const p of placed) c[p.live]++;
    return c;
  }, [placed]);

  const total = towers?.length ?? 0;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[{ label: t("Home"), to: "/", icon: "🏠" }, { label: t("Map"), icon: "🗺️" }]} />
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">🗺️</span>
        <div>
          <h1 className="text-2xl font-extrabold">{t("Towers Map")}</h1>
          <p className="text-muted text-sm">
            {t("{mapped} of {total} towers have coordinates", { mapped: placed.length, total })}
            {" · "}
            <span style={{ color: STATUS_COLOR.up }}>{t("{n} online", { n: counts.up })}</span>{" · "}
            <span style={{ color: STATUS_COLOR.partial }}>{t("{n} partly offline", { n: counts.partial })}</span>{" · "}
            <span style={{ color: STATUS_COLOR.major }}>{t("{n} mostly offline", { n: counts.major })}</span>{" · "}
            <span style={{ color: STATUS_COLOR.down }}>{t("{n} offline", { n: counts.down })}</span>{" · "}
            <span className="text-muted2">{t("{n} unknown", { n: counts.unknown })}</span>
          </p>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
        {(["up", "partial", "major", "down", "unknown"] as TowerHealth[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-muted">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: STATUS_COLOR[s] }} />
            {t(HEALTH_LABEL[s])}
          </span>
        ))}
        <span className="text-muted2">— {t("lines show parent links")}</span>
      </div>

      {isLoading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : error ? (
        <div className="text-red">{t("Failed to load towers.")}</div>
      ) : placed.length === 0 ? (
        <div className="card px-5 py-8 text-center text-muted">
          {t("No towers have valid GPS coordinates yet.")}
        </div>
      ) : (
        <div className="border border-line rounded-[13px] overflow-hidden" style={{ height: "72vh" }}>
          <MapContainer
            bounds={bounds ?? undefined}
            center={bounds ? undefined : FALLBACK_CENTER}
            zoom={bounds ? undefined : FALLBACK_ZOOM}
            boundsOptions={{ padding: [40, 40] }}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {edges.map((e, i) => (
              <Polyline
                key={i}
                positions={[[e.a.lat, e.a.lng], [e.b.lat, e.b.lng]]}
                pathOptions={{ color: "#64748b", weight: 1.5, opacity: 0.5 }}
              />
            ))}

            {placed.map((p) => (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={7}
                pathOptions={{
                  color: "#0b0f17",
                  weight: 1.5,
                  fillColor: STATUS_COLOR[p.live],
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <div className="font-extrabold text-base mb-1">{p.name}</div>
                    <div className="mb-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full align-middle me-1"
                        style={{ background: STATUS_COLOR[p.live] }}
                      />
                      {t(HEALTH_LABEL[p.live])}
                      {p.status && p.status !== "Active" ? ` · ${p.status}` : ""}
                    </div>
                    {p.area && <div className="text-muted">📍 {p.area}</div>}
                    {p.agent && <div className="text-muted">👤 {p.agent}</div>}
                    {p.phone && (
                      <div className="text-muted">
                        📞{" "}
                        {digits(p.phone) ? (
                          <a
                            href={`https://wa.me/${digits(p.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan hover:underline"
                          >
                            {p.phone}
                          </a>
                        ) : (
                          p.phone
                        )}
                      </div>
                    )}
                    <Link to={`/tower/${p.id}`} className="text-cyan hover:underline inline-block mt-2 font-bold">
                      {t("Open tower")} ↗
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
    </main>
  );
}
