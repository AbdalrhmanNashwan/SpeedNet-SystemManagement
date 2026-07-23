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
 * Cycles asc → desc → off. The third click matters: for several tables the
 * incoming order is meaningful (History is newest-first from the server,
 * device rows are in insertion order), so "no sort" has to stay reachable
 * rather than being trapped between two sorted views.
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
      !s || s.key !== key
        ? { key, dir: "asc" }
        : s.dir === "asc"
          ? { key, dir: "desc" }
          : null,
    );

  return { sorted, sort, toggle, setSort };
}
