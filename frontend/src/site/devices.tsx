/**
 * Outdoor wireless gear as SVG line-art — rooftop CPE/receiver, dish antenna,
 * sector antenna, lattice tower. Generic device shapes, no specific brands.
 * Stroke uses currentColor (set to cyan by the caller) so it matches the theme;
 * signal arcs pulse via .dev-wave. Tiny + crisp + resolution-independent —
 * no images, fast on any connection.
 */
type P = { className?: string };

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Nested pulsing signal arcs opening upward from (cx, topY). */
function Waves({ cx, topY }: { cx: number; topY: number }) {
  const arc = (r: number) =>
    `M ${cx - r} ${topY - r * 0.45} A ${r} ${r} 0 0 1 ${cx + r} ${topY - r * 0.45}`;
  return (
    <g stroke="currentColor" fill="none" strokeWidth={3} strokeLinecap="round">
      <path className="dev-wave" d={arc(20)} />
      <path className="dev-wave w2" d={arc(34)} />
      <path className="dev-wave w3" d={arc(48)} />
    </g>
  );
}

export function OutdoorUnit({ className }: P) {
  return (
    <svg viewBox="0 0 200 230" className={className} role="img" aria-label="Outdoor wireless unit">
      <g {...common}>
        {/* pole + mount arm */}
        <line x1="50" y1="78" x2="50" y2="212" strokeWidth="6" />
        <line x1="50" y1="128" x2="80" y2="128" />
        {/* CPE body */}
        <rect x="76" y="74" width="58" height="108" rx="16" fill="rgba(34,211,238,.06)" />
        {/* LED status row */}
        <line x1="88" y1="92" x2="122" y2="92" strokeWidth="2.5" opacity=".55" />
        {/* brand window */}
        <rect x="96" y="116" width="18" height="26" rx="4" strokeWidth="2.5" opacity=".5" />
      </g>
      {/* LED dots */}
      <g fill="currentColor">
        {[90, 100, 110, 120].map((x) => <circle key={x} cx={x} cy="166" r="2.4" />)}
      </g>
      <Waves cx={105} topY={74} />
    </svg>
  );
}

export function DishAntenna({ className }: P) {
  return (
    <svg viewBox="0 0 200 230" className={className} role="img" aria-label="Dish antenna">
      <g {...common}>
        {/* pole */}
        <line x1="56" y1="120" x2="56" y2="212" strokeWidth="6" />
        <line x1="56" y1="150" x2="86" y2="138" />
        {/* parabolic dish */}
        <circle cx="116" cy="104" r="52" fill="rgba(34,211,238,.06)" />
        <path d="M82 104a34 18 0 0 0 68 0" strokeWidth="2.6" opacity=".55" />
        {/* feed arm + feed */}
        <line x1="116" y1="104" x2="146" y2="74" strokeWidth="2.8" />
        <circle cx="148" cy="71" r="7" fill="rgba(34,211,238,.12)" />
      </g>
      <Waves cx={120} topY={56} />
    </svg>
  );
}

export function SectorAntenna({ className }: P) {
  return (
    <svg viewBox="0 0 200 230" className={className} role="img" aria-label="Sector antenna">
      {/* broadcast fan */}
      <path d="M108 70 L40 26 A 92 92 0 0 0 40 114 Z" fill="rgba(34,211,238,.08)"
        className="dev-wave" stroke="none" />
      <g {...common}>
        {/* pole */}
        <line x1="120" y1="60" x2="120" y2="212" strokeWidth="6" />
        {/* sector panel */}
        <rect x="100" y="46" width="34" height="120" rx="12" fill="rgba(34,211,238,.06)" />
        <line x1="117" y1="62" x2="117" y2="150" strokeWidth="2.4" opacity=".5" />
      </g>
    </svg>
  );
}

export function Tower({ className }: P) {
  return (
    <svg viewBox="0 0 200 230" className={className} role="img" aria-label="Network tower">
      <g {...common}>
        {/* lattice legs */}
        <line x1="64" y1="210" x2="92" y2="58" />
        <line x1="136" y1="210" x2="108" y2="58" />
        {/* cross braces */}
        {[
          [72, 178, 128, 178], [78, 146, 122, 146], [84, 114, 116, 114], [88, 86, 112, 86],
        ].map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="2.4" />)}
        {[
          [72, 178, 122, 146], [128, 178, 78, 146], [78, 146, 116, 114], [122, 146, 84, 114],
        ].map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.8" opacity=".55" />)}
        {/* head unit */}
        <rect x="90" y="44" width="20" height="16" rx="3" fill="rgba(34,211,238,.1)" />
      </g>
      <Waves cx={100} topY={44} />
    </svg>
  );
}
