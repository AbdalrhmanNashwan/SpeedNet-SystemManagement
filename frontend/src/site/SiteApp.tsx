import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import SiteLanding from "./SiteLanding";

/** Little animated signal-bars mark — reads instantly as "wireless ISP". */
function SignalMark() {
  return (
    <span className="flex items-end gap-[3px] h-5" aria-hidden>
      {[8, 12, 16, 20].map((h, i) => (
        <span key={h} className="w-[3px] rounded-full bg-gradient-to-t from-blue to-cyan sig-bar"
          style={{ height: h, animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

/** Public corporate site shell: its own translucent header + the landing page.
 *  Fully isolated from the admin console — delete src/site/ + its route to remove. */
export default function SiteApp() {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // The page scrolls inside .site-reels (a scroll-snap container), so watch
  // that element. We also publish scroll progress (0..1) as the --scroll CSS
  // var so the 3D network sphere rotates with the scroll. rAF-throttled and it
  // only writes one CSS var — no React re-render — so it stays cheap.
  const ticking = useRef(false);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScrolled(el.scrollTop > 8);
    if (!ticking.current) {
      ticking.current = true;
      requestAnimationFrame(() => {
        const max = el.scrollHeight - el.clientHeight;
        el.style.setProperty("--scroll", max > 0 ? (el.scrollTop / max).toFixed(4) : "0");
        ticking.current = false;
      });
    }
  };

  const links = [
    { href: "#home", label: t("Home") },
    { href: "#about", label: t("About") },
    { href: "#coverage", label: t("Coverage") },
    { href: "#contact", label: t("Contact") },
  ];

  // Scroll-spy: highlight the nav link for the panel you're currently on.
  const [active, setActive] = useState("home");
  useEffect(() => {
    const ids = links.map((l) => l.href.slice(1));
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { threshold: 0.55 },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="site-reels" onScroll={onScroll}>
      {/* Scroll-linked 3D network sphere, fixed behind all panels */}
      <div className="scroll-scene" aria-hidden>
        <div className="scroll-orb">
          <div className="scroll-orb-inner">
            <span className="ring" /><span className="ring" /><span className="ring" />
            <span className="ring" /><span className="ring" /><span className="ring" />
            <span className="ring" /><span className="ring" />
            <span className="core" />
          </div>
        </div>
      </div>

      {/* Clean full-width bar — hairline appears only on scroll */}
      <header className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-bg/70 backdrop-blur-xl border-b border-line/70" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto h-16 px-5 sm:px-8 flex items-center">
          <a href="#home" className="flex items-center gap-2.5 shrink-0">
            <SignalMark />
            <span className="font-extrabold text-xl tracking-tight">
              <span className="text-text">SPEED</span><span className="text-cyan">NeT</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8 mx-auto">
            {links.map((l) => {
              const on = active === l.href.slice(1);
              return (
                <a key={l.href} href={l.href}
                  className={`relative text-sm font-semibold py-1 transition-colors ${
                    on ? "text-text" : "text-muted hover:text-text"
                  }`}>
                  {l.label}
                  <span className={`absolute -bottom-0.5 inset-x-0 h-[2px] rounded-full bg-cyan transition-transform origin-center duration-300 ${
                    on ? "scale-x-100" : "scale-x-0"
                  }`} aria-hidden />
                </a>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3 ms-auto">
            <LanguageToggle />
            <ThemeToggle />
            <a href="#contact"
              className="ms-1 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white hover:brightness-110 transition"
              style={{ background: "linear-gradient(135deg,#3b82f6,#22d3ee)" }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.11 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.26-1.26a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {t("Get connected")}
            </a>
          </div>

          {/* mobile */}
          <div className="flex items-center gap-2 ms-auto md:hidden">
            <LanguageToggle />
            <button onClick={() => setOpen((o) => !o)} aria-label={t("Menu")}
              className="w-10 h-10 -me-2 flex items-center justify-center text-text">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-line bg-bg/95 backdrop-blur-xl px-5 py-3 flex flex-col">
            {links.map((l) => {
              const on = active === l.href.slice(1);
              return (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                  className={`py-3 text-sm font-semibold border-b border-line/40 ${on ? "text-cyan" : "text-muted"}`}>
                  {l.label}
                </a>
              );
            })}
            <a href="#contact" onClick={() => setOpen(false)}
              className="mt-3 block text-center px-4 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#3b82f6,#22d3ee)" }}>
              {t("Get connected")}
            </a>
          </div>
        )}
      </header>

      <SiteLanding />
    </div>
  );
}
