import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTowers } from "@/hooks/useTowers";
import { useDevices } from "@/hooks/useDevices";
import { useZones } from "@/hooks/useZones";
import { useIpAllocations } from "@/hooks/useIpAllocations";
import { useAuth } from "@/hooks/useAuth";
import { DEVICE_SECTIONS } from "@/lib/deviceSections";
import { Icon } from "@/components/Icon";
import { useT } from "@/i18n";
import { emojiIcon } from "@/lib/emoji";
import type { Device, DeviceType, IPAllocation, Tower, Zone } from "@/types";

/** "Search in" presets — restrict matching to a set of fields. Empty = any. */
const FIELD_FILTERS: { label: string; keys: string[] }[] = [
  { label: "Any field", keys: [] },
  { label: "Name", keys: ["name", "device_name", "ssid"] },
  { label: "Source switch (feed)", keys: ["fed_by", "feed_model", "feed_port", "feed_mode"] },
  { label: "VLAN", keys: ["vlan"] },
  { label: "IP", keys: ["ip", "ip_block", "ip_master", "ip_slave", "gateway", "subnet"] },
  { label: "Port", keys: ["port", "feed_port"] },
  { label: "MAC", keys: ["mac_address"] },
  { label: "Agent / reseller", keys: ["agent", "reseller", "wakil", "owner"] },
  { label: "Area", keys: ["area"] },
];

type Cat = "all" | "towers" | "devices" | "zones" | "ip";

/** Find the first field whose value contains the query — used to show *why* a
 *  row matched. `keys` limits the search to those fields (empty = scan all).
 *  Always skips id/foreign-key columns and secret (password) fields. */
function matchField(obj: Record<string, unknown>, lq: string, keys: string[]): { key: string; value: string } | null {
  const candidates = keys.length ? keys : Object.keys(obj);
  for (const key of candidates) {
    if (key === "id" || key === "tower_id" || key === "zone_id" || key === "parent_id") continue;
    if (/pass|secret|unlock/i.test(key)) continue;   // never surface credentials
    const value = obj[key];
    if (typeof value === "string" && value.toLowerCase().includes(lq)) return { key, value };
  }
  return null;
}

export default function SearchResults() {
  const [params] = useSearchParams();
  const t = useT();
  const q = params.get("q") ?? "";
  const lq = q.trim().toLowerCase();
  const { user } = useAuth();
  const isAgent = user?.role === "agent";

  const [cat, setCat] = useState<Cat>("all");
  const [fieldLabel, setFieldLabel] = useState("Any field");
  const activeKeys = FIELD_FILTERS.find((f) => f.label === fieldLabel)?.keys ?? [];

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

  // --- matches (respect the "search in" field filter) ------------------------
  const towerHits = !lq ? [] : (towers ?? [])
    .filter((t) => inScope(t.zone_id))
    .map((t) => ({ tower: t, m: matchField(t as unknown as Record<string, unknown>, lq, activeKeys) }))
    .filter((x) => x.m);

  const zoneHits = !lq ? [] : (zones ?? [])
    .filter((z) => inScope(z.id))
    .map((z) => ({ zone: z, m: matchField(z as unknown as Record<string, unknown>, lq, activeKeys) }))
    .filter((x) => x.m);

  const deviceHits = !lq ? [] : DEVICE_SECTIONS.flatMap((sec) =>
    (deviceData[sec.type] ?? [])
      .map((d) => ({ section: sec, device: d, tower: towerById.get(d.tower_id) }))
      .filter((x) => inScope(x.tower?.zone_id))
      .map((x) => ({ ...x, m: matchField(x.device as unknown as Record<string, unknown>, lq, activeKeys) }))
      .filter((x) => x.m));

  const ipHits = !lq ? [] : (ipAllocs ?? [])
    .map((a) => ({ alloc: a, m: matchField(a as unknown as Record<string, unknown>, lq, activeKeys) }))
    .filter((x) => x.m);

  const counts = { towers: towerHits.length, devices: deviceHits.length, zones: zoneHits.length, ip: ipHits.length };
  const total = counts.towers + counts.devices + counts.zones + counts.ip;
  const show = (c: Cat) => cat === "all" || cat === c;

  // Cap rows per group so a broad query can't render thousands of DOM nodes.
  const GROUP_CAP = 50;
  const moreNote = (len: number) =>
    len > GROUP_CAP
      ? <p className="text-xs text-muted2 px-1 pt-1">{t("+{n} more — narrow your query or pick a filter above.", { n: len - GROUP_CAP })}</p>
      : null;

  const pathFor = (tower?: Tower) => {
    const zone = tower?.zone_id != null ? zoneById.get(tower.zone_id) : undefined;
    return [zone?.name, tower?.name].filter(Boolean).join(" › ");
  };

  const CAT_TABS: { key: Cat; label: string; n: number }[] = [
    { key: "all", label: t("All"), n: total },
    { key: "towers", label: t("Towers"), n: counts.towers },
    { key: "devices", label: t("Devices"), n: counts.devices },
    { key: "zones", label: t("Zones"), n: counts.zones },
    { key: "ip", label: t("IPs"), n: counts.ip },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-extrabold mb-1">{t("Search")}</h1>
      <p className="text-muted text-sm mb-5">
        {q ? <>{t("Results for")} <span className="text-text font-bold">"{q}"</span></>
           : t("Enter a query in the search box.")}
      </p>

      {/* filter bar */}
      {lq && (
        <div className="flex flex-wrap gap-3 items-center mb-7">
          <div className="inline-flex bg-panel2 border border-line rounded-lg p-0.5 gap-0.5">
            {CAT_TABS.map((c) => (
              <button key={c.key} onClick={() => setCat(c.key)} aria-pressed={cat === c.key}
                className={`text-[13px] font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  cat === c.key ? "bg-panel text-text shadow-sm" : "text-muted hover:text-text"}`}>
                {c.label} <span className="text-muted2 tabular-nums">{c.n}</span>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted ms-auto">
            {t("Search in")}
            <select value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)}
              className="bg-bg2 border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-cyan">
              {FIELD_FILTERS.map((f) => <option key={f.label} value={f.label}>{t(f.label)}</option>)}
            </select>
          </label>
        </div>
      )}

      {loading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : !lq ? null : total === 0 ? (
        <div className="text-muted">{t('Nothing found matching "{q}".', { q })}</div>
      ) : (
        <div className="flex flex-col gap-8">
          {show("zones") && zoneHits.length > 0 && (
            <Group label={t("Zones")} count={zoneHits.length}>
              {zoneHits.slice(0, GROUP_CAP).map(({ zone, m }) => (
                <ResultRow key={`z${zone.id}`} to={`/zone/${zone.id}`} icon={emojiIcon(zone.icon) ?? "🌐"}
                  title={zone.name} path={t("Home")} field={m!} />
              ))}
              {moreNote(zoneHits.length)}
            </Group>
          )}

          {show("towers") && towerHits.length > 0 && (
            <Group label={t("Towers")} count={towerHits.length}>
              {towerHits.slice(0, GROUP_CAP).map(({ tower, m }) => (
                <ResultRow key={`t${tower.id}`} to={`/tower/${tower.id}`} icon={<Icon name="tower" className="w-6 h-6 text-cyan" />}
                  title={tower.name} path={pathFor(tower)} field={m!} />
              ))}
              {moreNote(towerHits.length)}
            </Group>
          )}

          {show("devices") && deviceHits.length > 0 && (
            <Group label={t("Devices")} count={deviceHits.length}>
              {deviceHits.slice(0, GROUP_CAP).map(({ section, device, tower, m }) => (
                <ResultRow key={`${section.type}${device.id}`}
                  to={`/tower/${device.tower_id}?focus=${section.type}:${device.id}`}
                  icon={<Icon name={section.icon} className="w-6 h-6 text-cyan" />}
                  title={device.device_name || device.ssid || device.ip || `${t(section.label)} #${device.id}`}
                  path={`${pathFor(tower)} › ${t(section.label)}`}
                  field={m!} />
              ))}
              {moreNote(deviceHits.length)}
            </Group>
          )}

          {show("ip") && ipHits.length > 0 && (
            <Group label={t("IP Allocations")} count={ipHits.length}>
              {ipHits.slice(0, GROUP_CAP).map(({ alloc, m }) => (
                <ResultRow key={`ip${alloc.id}`}
                  to={`/ip-allocations?focus=${alloc.id}`}
                  icon={<Icon name="ip" className="w-6 h-6 text-cyan" />}
                  title={alloc.point || alloc.owner || alloc.ip_block || `IP block #${alloc.id}`}
                  path={[alloc.owner, alloc.tower_ref || t("no tower")].filter(Boolean).join(" › ")}
                  field={m!} />
              ))}
              {moreNote(ipHits.length)}
            </Group>
          )}

          {/* a category is selected but it has no hits */}
          {cat !== "all" && counts[cat] === 0 && (
            <div className="text-muted2 text-sm">{t("No matches in this category.")}</div>
          )}
        </div>
      )}

      {total > 0 && cat === "all" && (
        <p className="text-muted2 text-xs mt-8">{t(total === 1 ? "{n} result" : "{n} results", { n: total })}</p>
      )}
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
  to?: string; icon: React.ReactNode; title: string; path: string; field: { key: string; value: string };
}) {
  const inner = (
    <>
      <span className="text-2xl shrink-0 w-7 flex items-center justify-center">{icon}</span>
      <div className="min-w-0">
        <div className="font-bold text-[14px] truncate">{title}</div>
        <div className="text-[11px] text-muted2 truncate">{path}</div>
      </div>
      <div className="ms-auto text-end shrink-0 max-w-[40%]">
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
