import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTower, useUpdateTower, useDeleteTower } from "@/hooks/useTowers";
import { useDevices, useCreateDevice } from "@/hooks/useDevices";
import { useZones } from "@/hooks/useZones";
import { usePerms } from "@/hooks/usePerms";
import { EditableField } from "@/components/EditableField";
import { LocationPicker } from "@/components/LocationPicker";
import { DeviceTable } from "@/components/DeviceTable";
import { TransferDialog } from "@/components/TransferDialog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/Icon";
import { DEVICE_SECTIONS } from "@/lib/deviceSections";
import {
  STATUS_OPTIONS, LINK_TYPE_OPTIONS, SWITCH_TYPE_OPTIONS,
  FEED_MODE_OPTIONS, PORT_OPTIONS, FEED_MODEL_OPTIONS,
} from "@/lib/fieldOptions";
import { useT } from "@/i18n";
import { emojiIcon } from "@/lib/emoji";
import type { Device, DeviceType, Tower } from "@/types";

const META_FIELDS: { key: keyof Tower; label: string; mono?: boolean; options?: string[] }[] = [
  { key: "name", label: "Name" },
  { key: "agent", label: "Agent" },
  { key: "agency_id", label: "Agency ID", mono: true },
  { key: "reseller", label: "Reseller" },
  { key: "affiliate", label: "Affiliate" },
  { key: "phone", label: "Phone", mono: true },
  { key: "area", label: "Area" },
  { key: "link_type", label: "Link type", options: LINK_TYPE_OPTIONS },
  { key: "switch_type", label: "Switch type", options: SWITCH_TYPE_OPTIONS },
  { key: "user_count", label: "Users" },
  { key: "vlan", label: "VLAN", mono: true },
  { key: "admin_page", label: "Admin page", mono: true },
  { key: "admin_pass", label: "Admin password", mono: true },
  { key: "gps_lat", label: "GPS lat", mono: true },
  { key: "gps_lng", label: "GPS lng", mono: true },
  { key: "height", label: "Height" },
  { key: "port", label: "Port", mono: true },
  { key: "status", label: "Status", options: STATUS_OPTIONS },
  { key: "notes", label: "Notes" },
];

// Where the tower gets its service from — the four parts of a note like
// "328-bpwatani452-eth5-tag" (used to trace outages upstream).
const SERVICE_FIELDS: { key: keyof Tower; label: string; mono?: boolean; options?: string[] }[] = [
  { key: "feed_model", label: "Switch model", mono: true, options: FEED_MODEL_OPTIONS },
  { key: "fed_by", label: "Source switch", mono: true },
  { key: "feed_port", label: "Port", mono: true, options: PORT_OPTIONS },
  { key: "feed_mode", label: "Mode", options: FEED_MODE_OPTIONS },
];

function DeviceSection({
  towerId, section, canCreate, canUpdate, canDelete, highlightId,
}: {
  towerId: number;
  section: typeof DEVICE_SECTIONS[number];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  highlightId?: number;
}) {
  const { data: rows } = useDevices(section.type, towerId);
  const create = useCreateDevice(section.type);
  const t = useT();
  const [transfer, setTransfer] = useState<Device[] | null>(null);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <Icon name={section.icon} className="w-4 h-4 text-muted2" />
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted2">{t(section.label)}</h2>
        <span className="text-xs text-muted2">({rows?.length ?? 0})</span>
        {canCreate && (
          <button
            onClick={() => create.mutate({ tower_id: towerId })}
            className="ms-auto text-xs text-cyan hover:underline"
          >
            {t("+ Add")}
          </button>
        )}
      </div>
      {rows && rows.length > 0 ? (
        <DeviceTable
          type={section.type}
          rows={rows}
          cols={section.cols}
          canUpdate={canUpdate}
          canDelete={canDelete}
          highlightId={highlightId}
          onTransfer={(rows) => setTransfer(rows)}
        />
      ) : (
        <div className="text-muted2 text-sm">{t("None")}</div>
      )}
      {transfer && transfer.length > 0 && (
        <TransferDialog
          devices={transfer}
          type={section.type}
          onClose={() => setTransfer(null)}
        />
      )}
    </section>
  );
}

export default function TowerDetail() {
  const { id } = useParams<{ id: string }>();
  const towerId = Number(id);
  const perms = usePerms();
  const t = useT();
  const nav = useNavigate();
  const [params] = useSearchParams();
  // ?focus=<type>:<deviceId> — set when arriving from a device search result
  const [focusType, focusIdRaw] = (params.get("focus") ?? "").split(":");
  const focusId = focusIdRaw ? Number(focusIdRaw) : undefined;
  const { data: tower, isLoading } = useTower(towerId);
  const { data: zones } = useZones();
  const update = useUpdateTower();
  const deleteTower = useDeleteTower();
  const [pickingLocation, setPickingLocation] = useState(false);

  if (isLoading) return <div className="p-10 text-muted">{t("Loading…")}</div>;
  if (!tower) return <div className="p-10 text-muted">{t("Tower not found.")}</div>;

  // agents are limited to towers in their own zone
  const scoped = perms.inScope(tower);
  const canCreate = perms.canCreate && scoped;
  const canUpdate = perms.canUpdate && scoped;
  const canDelete = perms.canDelete && scoped;

  const zone = zones?.find((z) => z.id === tower.zone_id);

  const handleDelete = async () => {
    if (!confirm(t('Delete tower "{name}"? This cannot be undone.', { name: tower.name }))) return;
    await deleteTower.mutateAsync(towerId);
    nav("/towers", { replace: true });
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[
        { label: t("Home"), to: "/", icon: "🏠" },
        ...(zone ? [{ label: zone.name, to: `/zone/${zone.id}`, icon: emojiIcon(zone.icon) ?? "🌐" }] : [{ label: t("Towers"), to: "/towers" }]),
        { label: tower.name, icon: "🗼" },
      ]} />

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold break-words">{tower.name}</h1>
          <span className={`status mt-2 inline-flex ${(tower.status ?? "").toLowerCase().replace(/[^a-z]/g, "-")}`}>
            {tower.status}
          </span>
        </div>
        {canDelete && (
          <button onClick={handleDelete}
            className="text-xs text-red hover:underline shrink-0 mt-1">
            {t("Delete tower")}
          </button>
        )}
      </div>

      {/* Meta grid */}
      <div className="card p-6 mb-8">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted2 mb-4">{t("Tower Info")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
          {META_FIELDS.map(({ key, label, mono, options }) => (
            <div key={key}>
              <div className="text-[10px] text-muted2 uppercase tracking-wide font-bold mb-0.5">{t(label)}</div>
              <EditableField
                value={(tower as unknown as Record<string, string>)[key]}
                mono={mono}
                options={options}
                canEdit={canUpdate}
                onSave={(v) => { update.mutateAsync({ id: tower.id, patch: { [key]: v } }); }}
              />
            </div>
          ))}
        </div>
        {canUpdate && (
          <div className="mt-4 pt-4 border-t border-line">
            <button
              onClick={() => setPickingLocation(true)}
              className="text-sm text-cyan hover:underline"
            >
              {t("📍 Pick location on map")}
            </button>
          </div>
        )}
      </div>

      {/* Service source — where this tower's feed comes from */}
      <div className="card p-6 mb-8">
        <div className="flex items-baseline justify-between gap-4 mb-1 flex-wrap">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted2">{t("Service source")}</h2>
          {(tower.feed_model || tower.fed_by || tower.feed_port || tower.feed_mode) && (
            <span className="font-mono text-xs text-cyan">
              {[tower.feed_model, tower.fed_by, tower.feed_port, tower.feed_mode].filter(Boolean).join("-")}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted2 mb-4">{t("Where this tower gets its service from — trace outages back to here.")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3">
          {SERVICE_FIELDS.map(({ key, label, mono, options }) => (
            <div key={key}>
              <div className="text-[10px] text-muted2 uppercase tracking-wide font-bold mb-0.5">{t(label)}</div>
              <EditableField
                value={(tower as unknown as Record<string, string>)[key]}
                mono={mono}
                options={options}
                canEdit={canUpdate}
                onSave={(v) => { update.mutateAsync({ id: tower.id, patch: { [key]: v } }); }}
              />
            </div>
          ))}
        </div>
      </div>

      {pickingLocation && (
        <LocationPicker
          lat={tower.gps_lat}
          lng={tower.gps_lng}
          onCancel={() => setPickingLocation(false)}
          onSave={async (gps_lat, gps_lng) => {
            await update.mutateAsync({ id: tower.id, patch: { gps_lat, gps_lng } });
            setPickingLocation(false);
          }}
        />
      )}

      {/* Device sections */}
      {DEVICE_SECTIONS.map((s) => (
        <DeviceSection key={s.type} towerId={towerId} section={s}
          canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete}
          highlightId={focusType === s.type ? focusId : undefined} />
      ))}
    </main>
  );
}
