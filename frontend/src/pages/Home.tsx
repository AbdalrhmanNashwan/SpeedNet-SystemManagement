import { useState } from "react";
import { Link } from "react-router-dom";
import { useZones, useDeleteZone } from "@/hooks/useZones";
import { useTowers } from "@/hooks/useTowers";
import { useAuth } from "@/hooks/useAuth";
import { ZoneDialog } from "@/components/ZoneDialog";
import { DEVICE_SECTIONS } from "@/lib/deviceSections";
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
  const { user } = useAuth();
  const { data: zones, isLoading: zonesLoading } = useZones();
  const { data: towers } = useTowers();
  const deleteZone = useDeleteZone();
  const [dialog, setDialog] = useState<{ open: boolean; zone: Zone | null }>({ open: false, zone: null });

  const canEdit = user?.role === "admin" || user?.role === "editor";
  const isAgent = user?.role === "agent";

  // agents see only their own zone
  const visibleZones = isAgent ? zones?.filter((z) => z.id === user?.zone_id) : zones;

  const countByZone = (zoneId: number) =>
    towers?.filter((t) => t.zone_id === zoneId).length ?? 0;

  if (zonesLoading) {
    return <div className="p-10 text-muted">Loading…</div>;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Network Zones</h1>
          <p className="text-muted text-sm">Select a zone to view its towers and backbone links.</p>
        </div>
        {canEdit && (
          <button onClick={() => setDialog({ open: true, zone: null })}
            className="ml-auto bg-blue text-white text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-blue/80">
            + Add Zone
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
                className={`card p-5 flex flex-col gap-2 border-2 ${colorCls} hover:scale-[1.03] transition-transform`}
              >
                {zone.icon && <span className="text-3xl">{zone.icon}</span>}
                <div className="font-extrabold text-[15px] text-text">{zone.name}</div>
                {zone.tag && <div className="text-[11px] text-muted2 uppercase tracking-widest">{zone.tag}</div>}
                <div className="text-[12px] mt-auto text-muted">{count} tower{count !== 1 ? "s" : ""}</div>
              </Link>
              {canEdit && (
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setDialog({ open: true, zone })}
                    className="text-cyan text-[10px] hover:underline">Edit</button>
                  <button onClick={() => { if (confirm(`Delete zone "${zone.name}"?`)) deleteZone.mutate(zone.id); }}
                    className="text-red text-[10px] hover:underline">Del</button>
                </div>
              )}
            </div>
          );
        })}

        <Link
          to="/towers"
          className="card p-5 flex flex-col gap-2 border-dashed border-line text-muted hover:border-blue hover:text-blue transition-colors"
        >
          <span className="text-3xl">🗼</span>
          <div className="font-extrabold text-[15px]">{isAgent ? "My Towers" : "All Towers"}</div>
          <div className="text-[12px] mt-auto">
            {(isAgent ? countByZone(user?.zone_id ?? -1) : towers?.length ?? 0)} total
          </div>
        </Link>
      </div>

      {/* Browse by device section across the whole network */}
      <h2 className="text-lg font-extrabold mt-12 mb-1">Browse by Section</h2>
      <p className="text-muted text-sm mb-4">All devices of a type across every tower.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {DEVICE_SECTIONS.filter((s) => s.type !== "links").map((s) => (
          <Link key={s.type} to={`/devices/${s.type}`}
            className="card p-5 flex flex-col gap-2 border border-line hover:border-cyan hover:text-cyan transition-colors">
            <span className="text-3xl">{s.icon}</span>
            <div className="font-extrabold text-[15px]">{s.label}</div>
          </Link>
        ))}
        {canEdit && (
          <Link to="/ip-allocations"
            className="card p-5 flex flex-col gap-2 border border-line hover:border-cyan hover:text-cyan transition-colors">
            <span className="text-3xl">📡</span>
            <div className="font-extrabold text-[15px]">IP Allocations</div>
          </Link>
        )}
      </div>

      {dialog.open && (
        <ZoneDialog zone={dialog.zone} onClose={() => setDialog({ open: false, zone: null })} />
      )}
    </main>
  );
}
