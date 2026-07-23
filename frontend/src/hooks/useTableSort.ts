import { useMemo, useState } from "react";
import { compareCells, type SortDir } from "@/lib/sort";

export type SortState = { key: string; dir: SortDir } | null;

/** Per-column value extractor. Define these as a module-level constant, not
 *  inline in the component — an object literal is a new identity every render
 *  and would defeat the memo below. */
export type Accessors<T> = Record<string, (row: T) => unknown>;

/**
 * Click-to-sort state for a table.
 *
 * Two states only: a column is either ascending or descending. Clicking the
 * active column flips it; clicking a different one starts that column at
 * ascending. There is deliberately no third "unsorted" click — it reads as the
 * sort randomly breaking.
 */
export function useTableSort<T>(
  rows: T[],
  opts: { initial?: SortState; accessors?: Accessors<T> } = {},
) {
  const [sort, setSort] = useState<SortState>(opts.initial ?? null);
  const { accessors } = opts;

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const key = sort.key;
    const get = accessors?.[key] ?? ((r: T) => (r as Record<string, unknown>)[key]);
    // Array.prototype.sort is stable, so rows that tie keep their incoming
    // order instead of shuffling on every re-render.
    return [...rows].sort((a, b) => compareCells(get(a), get(b), sort.dir));
  }, [rows, sort, accessors]);

  const toggle = (key: string) =>
    setSort((s) =>
      s && s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  return { sorted, sort, toggle, setSort };
}
