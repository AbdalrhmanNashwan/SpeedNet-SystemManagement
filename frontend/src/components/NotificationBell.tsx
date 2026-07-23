import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAlerts, sendTestAlert, type AlertEvent } from "@/hooks/useAlerts";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n";

type TFn = (s: string, v?: Record<string, string | number>) => string;

const SEEN_KEY = "speednet:alerts:lastSeen";

/** Turn the backend's absolute link (…/console/tower/656) into a router path
 *  (/tower/656) so clicking navigates as an in-app SPA transition instead of a
 *  full page reload. Returns null when there's no usable link. */
function toInternalPath(link?: string | null): string | null {
  if (!link) return null;
  try {
    const u = new URL(link, window.location.origin);
    let p = u.pathname;
    if (p.startsWith("/console")) p = p.slice("/console".length) || "/";
    return p + u.search;
  } catch {
    return null;
  }
}

function tone(kind: AlertEvent["kind"]) {
  if (kind === "recovered") return { dot: "#34d399", text: "text-green" };
  if (kind === "mass_outage") return { dot: "#fbbf24", text: "text-yellow" };
  if (kind === "test") return { dot: "#60a5fa", text: "text-blue" };
  return { dot: "#fb7185", text: "text-red" };
}

function ago(iso: string, t: TFn, skewMs = 0) {
  // Correct for client clock skew: Date.now()+skewMs ≈ the server's "now".
  const s = Math.max(0, (Date.now() + skewMs - new Date(iso).getTime()) / 1000);
  if (s < 60) return t("just now");
  if (s < 3600) return t("{n}m ago", { n: Math.floor(s / 60) });
  if (s < 86400) return t("{n}h ago", { n: Math.floor(s / 3600) });
  return t("{n}d ago", { n: Math.floor(s / 86400) });
}

export function NotificationBell() {
  const { data, refetch } = useAlerts(true);
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(() =>
    Number(localStorage.getItem(SEEN_KEY) || 0));
  const ref = useRef<HTMLDivElement>(null);

  // Tick every 30s so the relative "x ago" labels stay live between polls.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // API returns events newest-first; render them in that order (newest on top).
  const events = data?.events ?? [];
  const skewMs = data?.skewMs ?? 0;
  // lastSeen is a client timestamp; shift it into the server's clock frame
  // (lastSeen + skew) before comparing against server-stamped event times.
  const unseen = useMemo(
    () => events.filter((e) => new Date(e.at).getTime() > lastSeen + skewMs).length,
    [events, lastSeen, skewMs]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const runTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await sendTestAlert();
      // Report per-channel, and surface Telegram's own rejection text — a wrong
      // token or a chat that never messaged the bot fails silently otherwise.
      const parts: string[] = [];
      if (r.telegram && !r.telegram_error) parts.push(t("Telegram sent ✓"));
      else parts.push(t("Telegram: {err}", { err: r.telegram_error || t("not configured") }));
      if (r.email) parts.push(t("Email sent ✓"));
      if (r.webhook) parts.push(t("Webhook sent ✓"));
      if (!r.alerts_enabled) parts.push(t("⚠ Alerts are OFF (ALERT_ENABLED=false) — automatic down alerts will not fire."));
      setTestMsg(parts.join(" · "));
      refetch();
    } catch {
      setTestMsg(t("Test failed — see server logs."));
    } finally {
      setTesting(false);
    }
  };

  const markSeen = () => {
    const now = Date.now();
    setLastSeen(now);
    localStorage.setItem(SEEN_KEY, String(now));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifications"
        onClick={() => { setOpen((o) => !o); if (!open) markSeen(); }}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-line2 text-muted hover:text-text">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center">
            {unseen > 99 ? "99+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:end-0 sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-2rem)] bg-panel border border-line rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="text-sm font-bold text-text">{t("Notifications")}</span>
            <span className="text-[11px] text-muted2">
              {data?.enabled ? t("Alerts on") : t("Alerts off")}
            </span>
          </div>
          <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted text-sm">
                {t("No alerts yet. You'll see device down/recovery events here.")}
              </div>
            ) : (
              events.map((e, i) => {
                const tn = tone(e.kind);
                const target = toInternalPath(e.link);
                const go = () => {
                  if (!target) return;
                  navigate(target);
                  setOpen(false);
                };
                return (
                  <div
                    key={`${e.at}-${e.ip ?? i}`}
                    role={target ? "button" : undefined}
                    tabIndex={target ? 0 : undefined}
                    onClick={target ? go : undefined}
                    onKeyDown={target ? (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } } : undefined}
                    className={`flex gap-3 px-4 py-3 border-b border-line/40 last:border-0 ${target ? "cursor-pointer hover:bg-line/30 focus:bg-line/30 focus:outline-none" : ""}`}
                  >
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: tn.dot }} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${tn.text}`}>{e.title}</p>
                      <p className="text-xs text-muted leading-snug">{e.body}</p>
                      <p className="text-[11px] text-muted2 mt-0.5">{ago(e.at, t, skewMs)}</p>
                    </div>
                    {target && (
                      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 self-center text-muted2 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {data && (
            <div className="px-4 py-2 border-t border-line text-[11px] text-muted2 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span>{t("Triggers after {n} failed checks · {m}m cooldown", { n: data.config.fail_threshold, m: data.config.cooldown_minutes })}</span>
                {user?.role === "admin" && (
                  <button onClick={runTest} disabled={testing}
                    className="ms-auto shrink-0 px-2 py-1 rounded-md border border-line2 font-bold text-muted hover:text-text disabled:opacity-50">
                    {testing ? t("Sending…") : t("Send test")}
                  </button>
                )}
              </div>
              {testMsg && <p className="text-text leading-snug">{testMsg}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
