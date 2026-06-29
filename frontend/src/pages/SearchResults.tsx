import { useSearchParams, Link } from "react-router-dom";
import { useTowers } from "@/hooks/useTowers";
import { useDevices } from "@/hooks/useDevices";
import { useZones } from "@/hooks/useZones";
import { useIpAllocations } from "@/hooks/useIpAllocations";
import { useAuth } from "@/hooks/useAuth";
import { DEVICE_SECTIONS } from "@/lib/deviceSections";
import type { Device, DeviceType, IPAllocation, Tower, Zone } from "@/types";

/** Find the first field whose value contains the query — used to show *why* a
 *  row matched. Skips id/foreign-key columns and secret (password) fields. */
function matchField(obj: Record<string, unknown>, lq: string): { key: string; value: string } | null {
  for (const [key, value] of Object.entries(obj)) {
    if (key === "id" || key === "tower_id" || key === "zone_id" || key === "parent_id") continue;
    if (/pass|secret|unlock/i.test(key)) continue;   // never surface credentials
    if (typeof value === "string" && value.toLowerCase().includes(lq)) {
      return { key, value };
    }
  }
  return null;
}

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const lq = q.trim().toLowerCase();
  const { user } = useAuth();
  const isAgent = user?.role === "agent";

  const { data: towers, isLoading: tl } = useTowers();
  const { data: zones } = useZones();
  const { data: ipAllocs } = useIpAllocations();
  const links = useDevices("links");
  const switches = useDevices("switches");
  const sectors = useDevices("sectors");
  const servers = useDevices("servers");

  const deviceData: Record<DeviceType, Device[] | undefined> = {
    links: links.data, switches: switches.data, sectors: sectors.data, servers: servers.data,
  };
  const loading = tl || links.isLoading || switches.isLoading || sectors.isLoading || servers.isLoading;

  const towerById = new Map<number, Tower>((towers ?? []).map((t) => [t.id, t]));
  const zoneById = new Map<number, Zone>((zones ?? []).map((z) => [z.id, z]));
  const inScope = (zoneId: number | null | undefined) =>
    !isAgent || zoneId === user?.zone_id;

  // --- matches ---------------------------------------------------------------
  const towerHits = !lq ? [] : (towers ?? [])
    .filter((t) => inScope(t.zone_id))
    .map((t) => ({ tower: t, m: matchField(t as unknown as Record<string, unknown>, lq) }))
    .filter((x) => x.m);

  const zoneHits = !lq ? [] : (zones ?? [])
    .filter((z) => inScope(z.id))
    .map((z) => ({ zone: z, m: matchField(z as unknown as Record<string, unknown>, lq) }))
    .filter((x) => x.m);

  const deviceHits = !lq ? [] : DEVICE_SECTIONS.flatMap((sec) =>
    (deviceData[sec.type] ?? [])
      .map((d) => ({ section: sec, device: d, tower: towerById.get(d.tower_id) }))
      .filter((x) => inScope(x.tower?.zone_id))
      .map((x) => ({ ...x, m: matchField(x.device as unknown as Record<string, unknown>, lq) }))
      .filter((x) => x.m));

  // IP allocations (editor+ only; carries upstream block IPs like master/slave)
  const ipHits = !lq ? [] : (ipAllocs ?? [])
    .map((a) => ({ alloc: a, m: matchField(a as unknown as Record<string, unknown>, lq) }))
    .filter((x) => x.m);

  const total = towerHits.length + zoneHits.length + deviceHits.length + ipHits.length;

  const pathFor = (tower?: Tower) => {
    const zone = tower?.zone_id != null ? zoneById.get(tower.zone_id) : undefined;
    return [zone?.name, tower?.name].filter(Boolean).join(" › ");
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-extrabold mb-1">Search</h1>
      <p className="text-muted text-sm mb-8">
        {q ? <>Results for <span className="text-text font-bold">"{q}"</span> — searched towers, devices, zones &amp; IP allocations</>
           : "Enter a query in the search box."}
      </p>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : !lq ? null : total === 0 ? (
        <div className="text-muted">Nothing found matching "{q}".</div>
      ) : (
        <div className="flex flex-col gap-8">
          {zoneHits.length > 0 && (
            <Group label="Zones" count={zoneHits.length}>
              {zoneHits.map(({ zone, m }) => (
                <ResultRow key={`z${zone.id}`} to={`/zone/${zone.id}`} icon={zone.icon ?? "🌐"}
                  title={zone.name} path="Home" field={m!} />
              ))}
            </Group>
          )}

          {towerHits.length > 0 && (
            <Group label="Towers" count={towerHits.length}>
              {towerHits.map(({ tower, m }) => (
                <ResultRow key={`t${tower.id}`} to={`/tower/${tower.id}`} icon="🗼"
                  title={tower.name} path={pathFor(tower)} field={m!} />
              ))}
            </Group>
          )}

          {deviceHits.length > 0 && (
            <Group label="Devices" count={deviceHits.length}>
              {deviceHits.map(({ section, device, tower, m }) => (
                <ResultRow key={`${section.type}${device.id}`}
                  to={`/tower/${device.tower_id}?focus=${section.type}:${device.id}`}
                  icon={section.icon}
                  title={device.device_name || device.ssid || device.ip || `${section.label} #${device.id}`}
                  path={`${pathFor(tower)} › ${section.label}`}
                  field={m!} />
              ))}
            </Group>
          )}

          {ipHits.length > 0 && (
            <Group label="IP Allocations" count={ipHits.length}>
              {ipHits.map(({ alloc, m }) => (
                <ResultRow key={`ip${alloc.id}`}
                  to={`/ip-allocations?focus=${alloc.id}`}
                  icon="📡"
                  title={alloc.point || alloc.owner || alloc.ip_block || `IP block #${alloc.id}`}
                  path={[alloc.owner, alloc.tower_ref || "no tower"].filter(Boolean).join(" › ")}
                  field={m!} />
              ))}
            </Group>
          )}
        </div>
      )}

      {total > 0 && <p className="text-muted2 text-xs mt-8">{total} result{total !== 1 ? "s" : ""}</p>}
    </main>
  );
}

function Group({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted2 mb-3">{label} ({count})</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function ResultRow({ to, icon, title, path, field }: {
  to?: string; icon: string; title: string; path: string; field: { key: string; value: string };
}) {
  const inner = (
    <>
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="font-bold text-[14px] truncate">{title}</div>
        <div className="text-[11px] text-muted2 truncate">{path}</div>
      </div>
      <div className="ml-auto text-right shrink-0 max-w-[40%]">
        <div className="text-[9px] uppercase tracking-wide text-muted2 font-bold">{field.key.replace(/_/g, " ")}</div>
        <div className="text-[12px] text-muted truncate font-mono">{field.value}</div>
      </div>
    </>
  );
  const cls = "card px-4 py-3 flex items-center gap-3";
  return to
    ? <Link to={to} className={`${cls} hover:border-cyan transition-colors`}>{inner}</Link>
    : <div className={`${cls} opacity-90`} title="No tower linked to this allocation">{inner}</div>;
}
