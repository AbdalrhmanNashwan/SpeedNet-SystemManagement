import { useState } from "react";
import { useTransferDevice } from "@/hooks/useDevices";
import { useTowers } from "@/hooks/useTowers";
import type { Device, DeviceType } from "@/types";

const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: "links", label: "P2P Links" },
  { value: "switches", label: "Switches" },
  { value: "sectors", label: "Sectors (APs)" },
  { value: "servers", label: "Servers" },
];

export function TransferDialog({
  devices, type, onClose,
}: {
  devices: Device[];
  type: DeviceType;
  onClose: () => void;
}) {
  const { data: towers } = useTowers();
  const transfer = useTransferDevice(type);
  const [toType, setToType] = useState<DeviceType>(type);
  const [toTower, setToTower] = useState<number>(devices[0]?.tower_id ?? 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const d of devices) {
      await transfer.mutateAsync({ id: d.id, to_type: toType, to_tower_id: toTower });
    }
    onClose();
  };

  const title = devices.length === 1
    ? (devices[0].device_name ?? devices[0].ssid ?? `Device #${devices[0].id}`)
    : `${devices.length} devices`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-8 w-full max-w-md">
        <h2 className="text-lg font-extrabold mb-1">Transfer {devices.length > 1 ? "Devices" : "Device"}</h2>
        <p className="text-muted text-sm mb-6">{title}</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">Target Section</label>
            <select value={toType} onChange={(e) => setToType(e.target.value as DeviceType)}
              className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue">
              {DEVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">Target Tower</label>
            <select value={toTower} onChange={(e) => setToTower(Number(e.target.value))}
              className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue">
              {towers?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-line text-muted text-sm hover:border-line2">
              Cancel
            </button>
            <button type="submit" disabled={transfer.isPending}
              className="flex-1 py-2 rounded-lg bg-cyan text-bg text-sm font-bold disabled:opacity-50">
              {transfer.isPending ? "Transferring…" : "Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
