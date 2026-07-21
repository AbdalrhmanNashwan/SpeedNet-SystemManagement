import type { ReactNode } from "react";

/**
 * One line-icon system for the whole console, so nothing renders as a raw OS
 * emoji (which look mismatched across platforms). Every glyph shares the same
 * 24×24 grid, 1.8 stroke, round caps and `currentColor` fill — so an icon
 * inherits the surrounding text colour and hover state automatically.
 *
 * Keep new glyphs in this same visual language (stroke-only, no fills).
 */
const ICON_PATHS: Record<string, ReactNode> = {
  // Point-to-point wireless link: two nodes joined, signal fanning out.
  links: (
    <>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
      <path d="M6.8 12h10.4" />
      <path d="M9.4 8.6a4.5 4.5 0 0 0 0 6.8" />
      <path d="M14.6 8.6a4.5 4.5 0 0 1 0 6.8" />
    </>
  ),
  // Network switch / rack unit with ports and a status LED.
  switches: (
    <>
      <rect x="2.5" y="7.5" width="19" height="9" rx="2" />
      <path d="M6 11v2" />
      <path d="M9 11v2" />
      <path d="M12 11v2" />
      <path d="M15 11v2" />
      <circle cx="18.6" cy="12" r="1" />
    </>
  ),
  // Sector antenna / access point broadcasting outward.
  sectors: (
    <>
      <path d="M12 21v-7" />
      <circle cx="12" cy="12" r="1.8" />
      <path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8" />
      <path d="M15.4 8.6a4.8 4.8 0 0 1 0 6.8" />
      <path d="M6.1 6.1a8.3 8.3 0 0 0 0 11.8" />
      <path d="M17.9 6.1a8.3 8.3 0 0 1 0 11.8" />
    </>
  ),
  // Stacked server units.
  servers: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <circle cx="7" cy="7.5" r="0.7" />
      <circle cx="7" cy="16.5" r="0.7" />
      <path d="M11 7.5h6" />
      <path d="M11 16.5h6" />
    </>
  ),
  // Transmission tower with signal.
  tower: (
    <>
      <path d="M12 9v12" />
      <path d="M7.5 21 12 9l4.5 12" />
      <path d="M9 16h6" />
      <path d="M8.8 6.2a5 5 0 0 1 6.4 0" />
      <path d="M6.4 4a8.5 8.5 0 0 1 11.2 0" />
    </>
  ),
  // IP / network allocation: a node branching to sub-nodes.
  ip: (
    <>
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v3.5" />
      <path d="M12 10.5 5.8 17.4" />
      <path d="M12 10.5l6.2 6.9" />
    </>
  ),
};

export type IconName = keyof typeof ICON_PATHS;

/** Inline stroke icon. `name` must exist in ICON_PATHS; size via `className`. */
export function Icon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  );
}
