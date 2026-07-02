import { useState } from "react";
import { Link } from "react-router-dom";
import { useZones, useDeleteZone } from "@/hooks/useZones";
import { useTowers } from "@/hooks/useTowers";
import { usePerms } from "@/hooks/usePerms";
import { ZoneDialog } from "@/components/ZoneDialog";
import { DEVICE_SECTIONS } from "@/lib/deviceSections";
import { emojiIcon } from "@/lib/emoji";
import { useT } from "@/i18n";
import type { Zone } from "@/types";

const ZONE_COLORS: Record<string, string> = {
  cyan: "border-cyan text-cyan",
  blue: "border-blue text-blue",
  green: "border-green text-green",
  yellow: "border-yellow text-yellow",
  orange: "border-orange text-orange",
  purple: "border-purple text-purple",
  red: "border-red text-red",
};

export default function Home() {
  const { user, isAgent, canCreate, canUpdate, canDelete, canSeeIpAllocations } = usePerms();
  const t = useT();
  const { data: zones, isLoading: zonesLoading } = useZones();
  const { data: towers } = useTowers();
  const deleteZone = useDeleteZone();
  const [dialog, setDialog] = useState<{ open: boolean; zone: Zone | null }>({ open: false, zone: null });

  // Zones are a company-wide structure: agents never manage them.
  const canAddZone = canCreate && !isAgent;
  const canEditZone = canUpdate && !isAgent;
  const canDeleteZone = canDelete && !isAgent;

  // agents see only their own zone
  const visibleZones = isAgent ? zones?.filter((z) => z.id === user?.zone_id) : zones;

  const countByZone = (zoneId: number) =>
    towers?.filter((t) => t.zone_id === zoneId).length ?? 0;

  if (zonesLoading) {
    return <div className="p-10 text-muted">Loading…</div>;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="relative overflow-hidden rounded-[22px] px-6 sm:px-8 py-7 sm:py-9 mb-8 flex items-center gap-4 border border-line"
        style={{ background: "linear-gradient(110deg,var(--panel) 0%,var(--bg2) 55%,var(--panel) 100%)" }}>
        {/* distinct, static accent: a soft corner glow + a thin gradient edge */}
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(420px circle at 100% 0%,rgba(34,211,238,.12),transparent 60%)" }} />
        <div aria-hidden className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: "linear-gradient(180deg,#22d3ee,#3b82f6)" }} />
        <div className="relative">
          <p className="text-cyan text-[11px] font-bold uppercase tracking-[0.25em] mb-2">{t("SPEEDNeT Console")}</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-1.5">
            {t("Network")}{" "}
            <span style={{ background: "linear-gradient(120deg,#22d3ee,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {t("Zones")}
            </span>
          </h1>
          <p className="text-muted text-sm">{t("Select a zone to view its towers and backbone links.")}</p>
        </div>
        {canAddZone && (
          <button onClick={() => setDialog({ open: true, zone: null })}
            className="relative ms-auto bg-blue text-white text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-blue/80">
            {t("+ Add Zone")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {visibleZones?.map((zone) => {
          const colorCls = zone.color ? ZONE_COLORS[zone.color] ?? "border-line text-muted" : "border-line text-muted";
          const count = countByZone(zone.id);
          return (
            <div key={zone.id} className="relative group">
              <Link
                to={`/zone/${zone.id}`}
                className={`card tilt halo p-5 flex flex-col gap-2 border-2 ${colorCls}`}
              >
                {emojiIcon(zone.icon) && <span className="text-3xl">{emojiIcon(zone.icon)}</span>}
                <div className="font-extrabold text-[15px] text-text">{zone.name}</div>
                {zone.tag && <div className="text-[11px] text-muted2 uppercase tracking-widest">{zone.tag}</div>}
                <div className="text-[12px] mt-auto text-muted">{t(count === 1 ? "{n} tower" : "{n} towers", { n: count })}</div>
              </Link>
              {(canEditZone || canDeleteZone) && (
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEditZone && <button onClick={() => setDialog({ open: true, zone })}
                    className="text-cyan text-[10px] hover:underline">{t("Edit")}</button>}
                  {canDeleteZone && <button onClick={() => { if (confirm(t('Delete zone "{name}"?', { name: zone.name }))) deleteZone.mutate(zone.id); }}
                    className="text-red text-[10px] hover:underline">{t("Del")}</button>}
                </div>
              )}
            </div>
          );
        })}

        <Link
          to="/towers"
          className="card tilt p-5 flex flex-col gap-2 border-dashed border-line text-muted hover:border-blue hover:text-blue"
        >
          <span className="text-3xl">🗼</span>
          <div className="font-extrabold text-[15px]">{isAgent ? t("My Towers") : t("All Towers")}</div>
          <div className="text-[12px] mt-auto">
            {t("{n} total", { n: isAgent ? countByZone(user?.zone_id ?? -1) : towers?.length ?? 0 })}
          </div>
        </Link>
      </div>

      {/* Browse by device section across the whole network */}
      <h2 className="text-lg font-extrabold mt-12 mb-1">{t("Browse by Section")}</h2>
      <p className="text-muted text-sm mb-4">{t("All devices of a type across every tower.")}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {DEVICE_SECTIONS.filter((s) => s.type !== "links").map((s) => (
          <Link key={s.type} to={`/devices/${s.type}`}
            className="card tilt halo p-5 flex flex-col gap-2 border border-line hover:border-cyan hover:text-cyan">
            <span className="text-3xl">{s.icon}</span>
            <div className="font-extrabold text-[15px]">{t(s.label)}</div>
          </Link>
        ))}
        {canSeeIpAllocations && (
          <Link to="/ip-allocations"
            className="card tilt p-5 flex flex-col gap-2 border border-line hover:border-cyan hover:text-cyan">
            <span className="text-3xl">📡</span>
            <div className="font-extrabold text-[15px]">{t("IP Allocations")}</div>
          </Link>
        )}
      </div>

      {dialog.open && (
        <ZoneDialog zone={dialog.zone} onClose={() => setDialog({ open: false, zone: null })} />
      )}
    </main>
  );
}
