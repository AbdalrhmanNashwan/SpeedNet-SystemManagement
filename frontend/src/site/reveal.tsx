import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal, the lightweight & reliable way: one shared IntersectionObserver
 * toggles a CSS class as an element enters/leaves view; the actual motion is a
 * pure CSS transition (see `.reveal` in tokens.css). No scroll listeners, no
 * animation library, no images — so it stays fast even on slow connections.
 * Re-triggers on every entry (the full-screen "Reels" replay feel). Honors
 * prefers-reduced-motion.
 */
let observer: IntersectionObserver | null = null;
function getObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          e.target.classList.toggle("is-visible", e.isIntersecting);
        }
      },
      { threshold: 0.25 },
    );
  }
  return observer;
}

export function Reveal({
  children, className = "", delay = 0,
}: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }
    const obs = getObserver();
    obs.observe(el);
    return () => obs.unobserve(el);
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
