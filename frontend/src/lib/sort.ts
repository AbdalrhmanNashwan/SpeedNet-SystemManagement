// Comparators for clickable-header table sorting.
//
// Columns in this app are messy: IPs, VLAN numbers, ISO timestamps and free
// text all arrive as strings from the same text fields. A plain localeCompare
// gets the important cases wrong — "10.0.0.10" would sort before "10.0.0.9",
// which is exactly backwards for an ISP's device list — so this picks a
// comparison per value pair instead of assuming everything is text.
import { normalizeIp } from "./ip";

export type SortDir = "asc" | "desc";

const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/** A dotted IPv4 as a single 32-bit number, or null if it isn't one.
 *  Goes through normalizeIp first so "10.0.0.1/24" and "10.0.0.1:8728" sort
 *  alongside their plain peers rather than falling back to text order. */
export function ipKey(raw: string): number | null {
  const norm = normalizeIp(raw);
  if (!norm) return null;
  const m = V4.exec(norm);
  if (!m) return null;                       // IPv6 → let the text path handle it
  let n = 0;
  for (let i = 1; i <= 4; i++) {
    const octet = Number(m[i]);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n;
}

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function rawCompare(a: unknown, b: unknown): number {
  if (typeof a === "boolean" || typeof b === "boolean") return Number(!!a) - Number(!!b);
  if (typeof a === "number" && typeof b === "number") return a - b;

  const sa = String(a).trim();
  const sb = String(b).trim();

  const ia = ipKey(sa);
  const ib = ipKey(sb);
  if (ia !== null && ib !== null) return ia - ib;

  if (ISO_DATE.test(sa) && ISO_DATE.test(sb)) return Date.parse(sa) - Date.parse(sb);

  const na = Number(sa);
  const nb = Number(sb);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;

  // numeric:true gives natural order, so "Tower 10" follows "Tower 9"
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
}

/** Compare two cell values for `dir`.
 *
 *  Blank cells always sort LAST, in both directions. A blank means "no data",
 *  not "the smallest value" — without this, flipping to descending drags a
 *  wall of empty rows to the top and buries the data you were looking at. */
export function compareCells(a: unknown, b: unknown, dir: SortDir): number {
  const ba = isBlank(a);
  const bb = isBlank(b);
  if (ba && bb) return 0;
  if (ba) return 1;
  if (bb) return -1;
  const r = rawCompare(a, b);
  return dir === "asc" ? r : -r;
}
