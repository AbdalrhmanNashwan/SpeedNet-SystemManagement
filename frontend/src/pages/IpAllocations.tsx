import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useIpAllocations, useUpdateIpAllocation, useCreateIpAllocation, useDeleteIpAllocation,
} from "@/hooks/useIpAllocations";
import { useIpStatusMap } from "@/hooks/useMonitor";
import { EditableField } from "@/components/EditableField";
import { SortableTh } from "@/components/SortableTh";
import { StatusDot } from "@/components/StatusDot";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useTableSort } from "@/hooks/useTableSort";
import { normalizeIp } from "@/lib/ip";
import { usePerms } from "@/hooks/usePerms";
import { useT } from "@/i18n";
import type { IPAllocation } from "@/types";

// column key, header label, monospace?, is-an-ip-field?
const COLS: { key: keyof IPAllocation; label: string; mono?: boolean; ip?: boolean }[] = [
  { key: "point", label: "Point" },
  { key: "owner", label: "Owner" },
  { key: "tower_ref", label: "Tower ref" },
  { key: "link_type", label: "Link type" },
  { key: "parent", label: "Parent" },
  { key: "vlan", label: "VLAN", mono: true },
  { key: "ip_block", label: "IP block", mono: true, ip: true },
  { key: "ip_master", label: "IP master", mono: true, ip: true },
  { key: "user_master", label: "User master" },
  { key: "pass_master", label: "Pass master", mono: true },
  { key: "ip_slave", label: "IP slave", mono: true, ip: true },
  { key: "user_slave", label: "User slave" },
  { key: "pass_slave", label: "Pass slave", mono: true },
  { key: "sw_ip", label: "Switch IP", mono: true, ip: true },
  { key: "sw_pass", label: "Switch pass", mono: true },
  { key: "rs_pass", label: "RS pass", mono: true },
  { key: "note", label: "Note" },
];

/**
 * IP Allocations — the upstream IP-block registry (the "IP" sheet). Uncategorised
 * data that isn't tied to a tower; fully editable here. Editor+ only.
 */
export default function IpAllocations() {
  const { canCreate, canUpdate, canDelete } = usePerms();
  const t = useT();
  const { data: rows, isLoading } = useIpAllocations();
  const update = useUpdateIpAllocation();
  const create = useCreateIpAllocation();
  const del = useDeleteIpAllocation();
  const ipStatus = useIpStatusMap();
  const [q, setQ] = useState("");
  const [params] = useSearchParams();
  const focusId = params.get("focus") ? Number(params.get("focus")) : undefined;
  const scrolledFor = useRef<number | undefined>(undefined);  // scroll to focus only once

  const needle = q.trim().toLowerCase();
  const filtered = (rows ?? []).filter((a) =>
    !needle || COLS.some(({ key }) => String(a[key] ?? "").toLowerCase().includes(needle)));
  const { sorted, sort, toggle: toggleSort } = useTableSort(filtered);

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[{ label: t("Home"), to: "/", icon: "🏠" }, { label: t("IP Allocations"), icon: "📡" }]} />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-4xl">📡</span>
        <div>
          <h1 className="text-2xl font-extrabold">{t("IP Allocations")}</h1>
          <p className="text-muted text-sm">{t("Upstream IP-block registry · {n} rows", { n: rows?.length ?? 0 })}</p>
        </div>
        <div className="ms-auto flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Filter…")}
            className="bg-bg2 border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue w-56" />
          {canCreate && (
            <button onClick={() => create.mutate({ point: "" })}
              className="bg-blue text-white text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-blue/80">{t("+ Add row")}</button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : filtered.length === 0 ? (
        <div className="text-muted">{t("No allocations match.")}</div>
      ) : (
        <div className="border border-line rounded-[13px] overflow-auto max-h-[75vh]">
          <table className="w-full border-collapse text-[12.5px] whitespace-nowrap">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <SortableTh key={String(c.key)} label={t(c.label)} sortKey={String(c.key)}
                    sort={sort} onSort={toggleSort} />
                ))}
                {canDelete && <th className="sticky top-0 z-10 bg-panel border-b border-line" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const hl = a.id === focusId;
                return (
                  <tr key={a.id}
                    ref={hl ? (el) => {
                      if (el && scrolledFor.current !== focusId) {
                        scrolledFor.current = focusId;
                        el.scrollIntoView({ block: "center", behavior: "smooth" });
                      }
                    } : undefined}
                    className={`border-b border-line/50 ${hl ? "ring-2 ring-cyan ring-inset" : ""}`}>
                    {COLS.map((c) => {
                      const val = a[c.key] as string | null | undefined;
                      const norm = c.ip ? normalizeIp(val) : null;
                      const st = norm ? ipStatus.get(norm) : undefined;
                      return (
                        <td key={String(c.key)} className="px-3 py-2 border-b border-line/50">
                          <div className={c.ip ? "flex items-center gap-2" : ""}>
                            {c.ip && st && norm && <StatusDot status={st} ip={norm} title={`${norm} · ${st}`} />}
                            <EditableField
                              value={val}
                              mono={c.mono}
                              canEdit={canUpdate}
                              onSave={(v) => { update.mutateAsync({ id: a.id, patch: { [c.key]: v } }); }}
                            />
                          </div>
                        </td>
                      );
                    })}
                    {canDelete && (
                      <td className="px-3 py-2 border-b border-line/50 text-end">
                        <button onClick={() => { if (confirm(t("Delete this allocation row?"))) del.mutate(a.id); }}
                          className="text-red text-xs hover:underline">{t("Delete")}</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
