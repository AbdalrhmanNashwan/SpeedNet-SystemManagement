import type { SortState } from "@/hooks/useTableSort";
import { useT } from "@/i18n";

/** Shared header styling for the dense data tables (Monitor, IP Allocations,
 *  devices, History). Users.tsx passes its own roomier variant. */
export const TH_BASE =
  "sticky top-0 z-10 bg-panel text-start px-3 py-2 text-[9.5px] uppercase " +
  "tracking-wide text-muted2 font-extrabold border-b border-line";

/**
 * A table header cell that sorts its column when clicked.
 *
 * Omit `sortKey` for columns that aren't meaningfully sortable (actions,
 * checkboxes, rendered diffs) and it renders as a plain, inert header.
 */
export function SortableTh({
  label, sortKey, sort, onSort, className = "", thClass = TH_BASE,
}: {
  label: string;
  sortKey?: string;
  sort: SortState;
  onSort: (key: string) => void;
  className?: string;
  thClass?: string;
}) {
  const t = useT();
  const active = !!sortKey && sort?.key === sortKey;
  const dir = active ? sort!.dir : null;

  if (!sortKey) return <th className={`${thClass} ${className}`}>{label}</th>;

  return (
    <th
      className={`${thClass} ${className}`}
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={t("Sort by {col}", { col: label })}
        className={`group inline-flex items-center gap-1 uppercase tracking-wide font-extrabold
          hover:text-text focus:outline-none focus-visible:underline
          ${active ? "text-text" : ""}`}
      >
        <span>{label}</span>
        {/* Reserve the arrow's width always, so toggling doesn't reflow the
            header row; it just fades in. */}
        <span
          aria-hidden
          className={`text-[8px] leading-none transition-opacity ${
            active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
          }`}
        >
          {dir === "desc" ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}
