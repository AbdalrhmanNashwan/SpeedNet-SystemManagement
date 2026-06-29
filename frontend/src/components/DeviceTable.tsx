import { useState } from "react";
import type { Device, DeviceType } from "@/types";
import { EditableField } from "./EditableField";
import { StatusDot } from "./StatusDot";
import { useUpdateDevice, useDeleteDevice } from "@/hooks/useDevices";
import { useIpStatusMap } from "@/hooks/useMonitor";
import { normalizeIp } from "@/lib/ip";

interface Col { key: keyof Device; label: string; mono?: boolean; cls?: string; options?: string[]; }

/**
 * Renders a device section as an editable table. Every cell is an EditableField.
 * Rows can be multi-selected via checkboxes for bulk Delete / Transfer, and each
 * row also has its own Delete + Transfer actions. `canEdit` comes from the role.
 */
export function DeviceTable({
  type, rows, cols, canEdit, onTransfer, highlightId,
}: {
  type: DeviceType;
  rows: Device[];
  cols: Col[];
  canEdit: boolean;
  onTransfer: (rows: Device[]) => void;
  highlightId?: number;
}) {
  const update = useUpdateDevice(type);
  const del = useDeleteDevice(type);
  const ipStatus = useIpStatusMap();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const clear = () => setSelected(new Set());

  const selectedRows = rows.filter((r) => selected.has(r.id));

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedRows.length} selected row(s)? This cannot be undone.`)) return;
    for (const r of selectedRows) await del.mutateAsync(r.id);
    clear();
  };

  return (
    <div>
      {canEdit && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-2 px-3 py-2 rounded-lg bg-panel2 border border-line text-xs">
          <span className="font-bold">{selected.size} selected</span>
          <button onClick={() => onTransfer(selectedRows)} className="text-cyan hover:underline">Transfer selected</button>
          <button onClick={bulkDelete} className="text-red hover:underline">Delete selected</button>
          <button onClick={clear} className="text-muted hover:text-text ml-auto">Clear</button>
        </div>
      )}
      <div className="border border-line rounded-[13px] overflow-auto max-h-[75vh]">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {canEdit && (
                <th className="sticky top-0 z-10 bg-panel border-b border-line px-3 py-2 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
              )}
              {cols.map((c) => (
                <th key={String(c.key)} className="sticky top-0 z-10 bg-panel text-left px-3 py-2 text-[9.5px] uppercase tracking-wide text-muted2 font-extrabold border-b border-line">
                  {c.label}
                </th>
              ))}
              {canEdit && <th className="sticky top-0 z-10 bg-panel border-b border-line" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dim = r.flags?.some((f) => f === "no-access" || f === "virtual");
              const sel = selected.has(r.id);
              const hl = r.id === highlightId;
              return (
                <tr key={r.id}
                  ref={hl ? (el) => el?.scrollIntoView({ block: "center", behavior: "smooth" }) : undefined}
                  className={`${dim ? "opacity-50" : ""} ${sel ? "bg-panel2" : ""} ${hl ? "ring-2 ring-cyan ring-inset" : ""}`}>
                  {canEdit && (
                    <td className="px-3 py-2 border-b border-line/50">
                      <input type="checkbox" checked={sel} onChange={() => toggle(r.id)} aria-label={`Select row ${r.id}`} />
                    </td>
                  )}
                  {cols.map((c) => {
                    const norm = c.key === "ip" ? normalizeIp(r.ip) : null;
                    const st = norm ? ipStatus.get(norm) : undefined;
                    return (
                      <td key={String(c.key)} className={`px-3 py-2 border-b border-line/50 ${c.cls || ""}`}>
                        <div className={c.key === "ip" ? "flex items-center gap-2" : ""}>
                          {c.key === "ip" && st && norm && <StatusDot status={st} ip={norm} title={`${norm} · ${st}`} />}
                          <EditableField
                            value={r[c.key] as string}
                            mono={c.mono}
                            options={c.options}
                            canEdit={canEdit}
                            onSave={(v) => { update.mutateAsync({ id: r.id, patch: { [c.key]: v } }); }}
                          />
                        </div>
                      </td>
                    );
                  })}
                  {canEdit && (
                    <td className="px-3 py-2 border-b border-line/50 whitespace-nowrap text-right">
                      <button onClick={() => onTransfer([r])} className="text-cyan text-xs mr-3 hover:underline">Transfer</button>
                      <button onClick={() => { if (confirm("Delete this row?")) del.mutate(r.id); }} className="text-red text-xs hover:underline">Delete</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
