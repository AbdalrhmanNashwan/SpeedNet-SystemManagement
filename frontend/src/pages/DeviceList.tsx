import { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useDevices } from "@/hooks/useDevices";
import { useTowers } from "@/hooks/useTowers";
import { usePerms } from "@/hooks/usePerms";
import { DeviceTable } from "@/components/DeviceTable";
import { TransferDialog } from "@/components/TransferDialog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SECTION_BY_TYPE } from "@/lib/deviceSections";
import { useT } from "@/i18n";
import type { Device, DeviceType, Tower } from "@/types";

/** Network-wide view of one device section (P2P / Switches / Sectors / Servers),
 *  grouped by tower. Reuses the same editable table as the tower detail page. */
export default function DeviceList() {
  const { type } = useParams<{ type: string }>();
  const { canUpdate, canDelete, inScope } = usePerms();
  const t = useT();
  const section = SECTION_BY_TYPE[type as DeviceType];

  const { data: rows, isLoading } = useDevices(type as DeviceType);
  const { data: towers } = useTowers();
  const [transfer, setTransfer] = useState<Device[] | null>(null);

  if (!section) return <Navigate to="/" replace />;

  const towerById = new Map<number, Tower>((towers ?? []).map((t) => [t.id, t]));

  // group rows by tower, ordered by tower name
  const groups = new Map<number, Device[]>();
  for (const r of rows ?? []) {
    if (!groups.has(r.tower_id)) groups.set(r.tower_id, []);
    groups.get(r.tower_id)!.push(r);
  }
  const ordered = [...groups.entries()].sort((a, b) =>
    (towerById.get(a[0])?.name ?? "").localeCompare(towerById.get(b[0])?.name ?? ""));

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Breadcrumbs items={[
        { label: t("Home"), to: "/", icon: "🏠" },
        { label: t(section.label), icon: section.icon },
      ]} />
      <div className="flex items-center gap-3 mb-8">
        <span className="text-4xl">{section.icon}</span>
        <div>
          <h1 className="text-2xl font-extrabold">{t(section.label)}</h1>
          <p className="text-muted text-sm">{t(ordered.length === 1 ? "{n} across {t} tower" : "{n} across {t} towers", { n: rows?.length ?? 0, t: ordered.length })}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted">{t("Loading…")}</div>
      ) : ordered.length === 0 ? (
        <div className="text-muted">{t("No {label} found.", { label: t(section.label) })}</div>
      ) : (
        ordered.map(([towerId, devRows]) => {
          const tower = towerById.get(towerId);
          return (
            <section key={towerId} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Link to={`/tower/${towerId}`} className="text-sm font-extrabold hover:text-cyan">
                  {tower?.name ?? t("Tower #{id}", { id: towerId })}
                </Link>
                <span className="text-xs text-muted2">({devRows.length})</span>
              </div>
              <DeviceTable
                type={section.type}
                rows={devRows}
                cols={section.cols}
                canUpdate={canUpdate && inScope(tower)}
                canDelete={canDelete && inScope(tower)}
                onTransfer={(rs) => setTransfer(rs)}
              />
            </section>
          );
        })
      )}

      {transfer && transfer.length > 0 && (
        <TransferDialog devices={transfer} type={section.type} onClose={() => setTransfer(null)} />
      )}
    </main>
  );
}
