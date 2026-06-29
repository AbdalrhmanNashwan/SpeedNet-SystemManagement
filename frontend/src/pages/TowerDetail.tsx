import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTower, useUpdateTower, useDeleteTower } from "@/hooks/useTowers";
import { useDevices, useCreateDevice } from "@/hooks/useDevices";
import { useZones } from "@/hooks/useZones";
import { useAuth } from "@/hooks/useAuth";
import { EditableField } from "@/components/EditableField";
import { DeviceTable } from "@/components/DeviceTable";
import { TransferDialog } from "@/components/TransferDialog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DEVICE_SECTIONS } from "@/lib/deviceSections";
import {
  STATUS_OPTIONS, LINK_TYPE_OPTIONS, SWITCH_TYPE_OPTIONS,
} from "@/lib/fieldOptions";
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

function DeviceSection({
  towerId, section, canEdit, highlightId,
}: {
  towerId: number;
  section: typeof DEVICE_SECTIONS[number];
  canEdit: boolean;
  highlightId?: number;
}) {
  const { data: rows } = useDevices(section.type, towerId);
  const create = useCreateDevice(section.type);
  const [transfer, setTransfer] = useState<Device[] | null>(null);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted2">{section.label}</h2>
        <span className="text-xs text-muted2">({rows?.length ?? 0})</span>
        {canEdit && (
          <button
            onClick={() => create.mutate({ tower_id: towerId })}
            className="ml-auto text-xs text-cyan hover:underline"
          >
            + Add
          </button>
        )}
      </div>
      {rows && rows.length > 0 ? (
        <DeviceTable
          type={section.type}
          rows={rows}
          cols={section.cols}
          canEdit={canEdit}
          highlightId={highlightId}
          onTransfer={(rows) => setTransfer(rows)}
        />
      ) : (
        <div className="text-muted2 text-sm">None</div>
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
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  // ?focus=<type>:<deviceId> — set when arriving from a device search result
  const [focusType, focusIdRaw] = (params.get("focus") ?? "").split(":");
  const focusId = focusIdRaw ? Number(focusIdRaw) : undefined;
  const { data: tower, isLoading } = useTower(towerId);
  const { data: zones } = useZones();
  const update = useUpdateTower();
  const deleteTower = useDeleteTower();

  const canEdit = user?.role === "admin" || user?.role === "editor" ||
    (user?.role === "agent" && user.zone_id === tower?.zone_id);

  if (isLoading) return <div className="p-10 text-muted">Loading…</div>;
  if (!tower) return <div className="p-10 text-muted">Tower not found.</div>;

  const zone = zones?.find((z) => z.id === tower.zone_id);

  const handleDelete = async () => {
    if (!confirm(`Delete tower "${tower.name}"? This cannot be undone.`)) return;
    await deleteTower.mutateAsync(towerId);
    nav("/towers", { replace: true });
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[
        { label: "Home", to: "/", icon: "🏠" },
        ...(zone ? [{ label: zone.name, to: `/zone/${zone.id}`, icon: zone.icon ?? "🌐" }] : [{ label: "Towers", to: "/towers" }]),
        { label: tower.name, icon: "🗼" },
      ]} />

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold break-words">{tower.name}</h1>
          <span className={`status mt-2 inline-flex ${(tower.status ?? "").toLowerCase().replace(/[^a-z]/g, "-")}`}>
            {tower.status}
          </span>
        </div>
        {canEdit && (
          <button onClick={handleDelete}
            className="text-xs text-red hover:underline shrink-0 mt-1">
            Delete tower
          </button>
        )}
      </div>

      {/* Meta grid */}
      <div className="card p-6 mb-8">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted2 mb-4">Tower Info</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
          {META_FIELDS.map(({ key, label, mono, options }) => (
            <div key={key}>
              <div className="text-[10px] text-muted2 uppercase tracking-wide font-bold mb-0.5">{label}</div>
              <EditableField
                value={(tower as unknown as Record<string, string>)[key]}
                mono={mono}
                options={options}
                canEdit={canEdit}
                onSave={(v) => { update.mutateAsync({ id: tower.id, patch: { [key]: v } }); }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Device sections */}
      {DEVICE_SECTIONS.map((s) => (
        <DeviceSection key={s.type} towerId={towerId} section={s} canEdit={canEdit}
          highlightId={focusType === s.type ? focusId : undefined} />
      ))}
    </main>
  );
}
