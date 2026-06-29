import { useParams } from "react-router-dom";
import { useZones } from "@/hooks/useZones";
import { useTowers } from "@/hooks/useTowers";
import { TowerCard } from "@/components/TowerCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function ZonePage() {
  const { id } = useParams<{ id: string }>();
  const zoneId = Number(id);

  const { data: zones } = useZones();
  const { data: towers, isLoading } = useTowers({ zone_id: zoneId });

  const zone = zones?.find((z) => z.id === zoneId);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[
        { label: "Home", to: "/", icon: "🏠" },
        { label: zone?.name ?? "Zone", icon: zone?.icon ?? "🌐" },
      ]} />

      <div className="flex items-center gap-3 mb-8">
        {zone?.icon && <span className="text-4xl">{zone.icon}</span>}
        <div>
          <h1 className="text-2xl font-extrabold">{zone?.name ?? "Zone"}</h1>
          {zone?.tag && <div className="text-xs text-muted2 uppercase tracking-widest mt-0.5">{zone.tag}</div>}
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted">Loading…</div>
      ) : towers?.length === 0 ? (
        <div className="text-muted">No towers in this zone.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {towers?.map((t) => <TowerCard key={t.id} tower={t} />)}
        </div>
      )}
    </main>
  );
}
