import type { PingStatus } from "@/types";
import { useForcePing } from "@/hooks/useMonitor";
import { useT } from "@/i18n";

const STYLE: Record<PingStatus, { dot: string; label: string; text: string }> = {
  up:      { dot: "bg-green shadow-[0_0_6px_var(--green)]", label: "Online",  text: "text-green" },
  down:    { dot: "bg-red shadow-[0_0_6px_var(--red)]",     label: "Offline", text: "text-red" },
  unknown: { dot: "bg-muted2",                              label: "Unknown", text: "text-muted2" },
};

/**
 * Small colored dot for an IP's ping status. `withLabel` adds the word.
 * If `ip` is given the dot becomes a button: clicking it forces an immediate
 * re-ping of that IP and refreshes the status.
 */
export function StatusDot({
  status, withLabel, title, ip,
}: { status: PingStatus; withLabel?: boolean; title?: string; ip?: string }) {
  const s = STYLE[status];
  const t = useT();
  const force = useForcePing();
  const busy = force.isPending;

  const content = (
    <>
      <span className={`inline-block w-2 h-2 rounded-full ${s.dot} ${
        busy ? "animate-ping" : status === "up" ? "animate-pulse" : ""
      }`} />
      {withLabel && <span className="text-[11px] font-bold">{t(s.label)}</span>}
    </>
  );

  if (!ip) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${withLabel ? s.text : ""}`}
            title={title ?? t(s.label)}>{content}</span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); force.mutate(ip); }}
      title={busy ? t("Pinging…") : `${title ?? t(s.label)} — ${t("click to re-ping")}`}
      className={`inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 disabled:cursor-wait ${withLabel ? s.text : ""}`}
    >
      {content}
    </button>
  );
}
