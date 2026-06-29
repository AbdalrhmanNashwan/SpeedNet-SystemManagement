// Best-effort extraction of a single host IP from a messy field value.
// Mirrors backend app/services/monitor.py:_parse_ip so inline dots line up
// with what the server actually pinged.
const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let token = raw.trim().split(/\s+/)[0];
  if (!token) return null;
  if (token.includes("/")) token = token.split("/")[0];
  const tryParse = (s: string) => {
    const m = s.match(V4);
    if (m && m.slice(1).every((o) => +o >= 0 && +o <= 255)) return s;
    if (s.includes(":") && /^[0-9a-fA-F:]+$/.test(s)) return s; // crude IPv6
    return null;
  };
  const direct = tryParse(token);
  if (direct) return direct;
  if (token.includes(":")) return tryParse(token.slice(0, token.lastIndexOf(":")));
  return null;
}
