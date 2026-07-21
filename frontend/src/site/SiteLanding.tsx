import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/i18n";
import { Reveal } from "./reveal";
import { OutdoorUnit, DishAntenna, SectorAntenna, Tower } from "./devices";

/** Previously a per-panel radial color glow; the redesign keeps surfaces flat,
    so this renders nothing. Kept so panel markup stays unchanged (and the old
    look can be restored from the checkpoint commit). */
function Glow(_props: { color: string; at: string }) {
  return null;
}

/** Simple line icons (Feather-style) for the contact cards — no emoji. */
const ICON_PATHS: Record<string, ReactNode> = {
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.11 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.26-1.26a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  send: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
};

function Icon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}

/** Full-screen story panel: an outdoor device on one side, the message on the other. */
function DevicePanel({
  id, device, eyebrow, title, body, glow, at, flip,
}: {
  id: string; device: ReactNode; eyebrow: string; title: string; body: string;
  glow: string; at: string; flip?: boolean;
}) {
  return (
    <section id={id} data-panel className="panel">
      <Glow color={glow} at={at} />
      <div className="w-full max-w-5xl mx-auto grid md:grid-cols-2 items-center gap-10 sm:gap-16">
        <Reveal className={`flex justify-center ${flip ? "md:order-2" : ""}`}>
          <div className="text-cyan dev-float w-48 sm:w-64">{device}</div>
        </Reveal>
        <Reveal delay={150} className={`text-center md:text-start ${flip ? "md:order-1" : ""}`}>
          <p className="text-cyan text-[11px] font-bold uppercase tracking-[0.3em] mb-3">{eyebrow}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight">{title}</h2>
          <p className="text-muted text-base sm:text-lg leading-relaxed max-w-md md:max-w-none mx-auto">{body}</p>
        </Reveal>
      </div>
    </section>
  );
}

/** Right-side dots: shows which panel you're on, click to jump. */
function PanelDots({ ids }: { ids: { id: string; label: string }[] }) {
  const [active, setActive] = useState(ids[0]?.id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { threshold: 0.55 },
    );
    ids.forEach(({ id }) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [ids]);
  return (
    <div className="reels-dots hidden sm:flex" aria-hidden>
      {ids.map(({ id, label }) => (
        <button key={id} title={label} className={active === id ? "active" : ""}
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })} />
      ))}
    </div>
  );
}

export default function SiteLanding() {
  const t = useT();

  const panels = [
    { id: "home", label: t("Home") },
    { id: "about", label: t("About") },
    { id: "speed", label: t("Speed") },
    { id: "reliability", label: t("Reliability") },
    { id: "rooftop", label: t("Your link") },
    { id: "coverage", label: t("Coverage") },
    { id: "contact", label: t("Contact") },
  ];

  const areas = [
    t("Tel Kaif"), t("Al-Jazair"),
    t("Al-Qusayat"), t("Al-Hawi"),
  ];

  return (
    <>
      <PanelDots ids={panels} />

      {/* ===== Hero ===== */}
      <section id="home" data-panel className="panel">
        <Reveal>
          <span className="inline-block glass rounded-full px-4 py-1.5 text-xs font-bold text-cyan mb-7">
            {t("Mosul & Nineveh")} · {t("since 2010")}
          </span>
        </Reveal>
        <Reveal delay={90}>
          <h1 className="text-5xl sm:text-7xl font-extrabold leading-[1.05] mb-5">
            {t("Your neighbors'")}<br />
            <span className="site-hero-text">{t("internet company.")}</span>
          </h1>
        </Reveal>
        <Reveal delay={180}>
          <p className="text-muted text-lg max-w-xl mx-auto mb-9 leading-relaxed">
            {t("Since 2010 we've put antennas on rooftops across Mosul — our own wireless network, kept running by a local team you can actually reach by phone or WhatsApp.")}
          </p>
        </Reveal>
        <Reveal delay={260}>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="#contact" className="px-7 py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: "var(--blue)" }}>
              {t("Get connected")}
            </a>
            <a href="#speed" className="px-7 py-3 rounded-xl font-bold text-sm border border-line2 text-text hover:border-cyan transition-colors">
              {t("How it works")}
            </a>
          </div>
        </Reveal>
        <a href="#speed" aria-label={t("Scroll down")}
          className="reels-hint absolute bottom-8 text-muted2 hover:text-cyan">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      </section>

      {/* ===== About ===== */}
      <section id="about" data-panel className="panel">
        <Glow color="rgba(59,130,246,.14)" at="30% 45%" />
        <div className="w-full max-w-3xl mx-auto text-center">
          <Reveal>
            <p className="text-cyan text-[11px] font-bold uppercase tracking-[0.3em] mb-3">{t("About us")}</p>
          </Reveal>
          <Reveal delay={90}>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 leading-tight">{t("A local network, built tower by tower")}</h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-muted text-base sm:text-lg leading-relaxed mb-10">
              {t("We started in Mosul in 2010 with a handful of rooftops. Today our own towers and antennas reach homes and businesses across the city and the Nineveh plains. We install it, we maintain it, and when something goes wrong you talk to people here — not a call center in another country.")}
            </p>
          </Reveal>
          <Reveal delay={230}>
            <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
              {[
                { n: t("15+ yrs"), l: t("Serving Mosul") },
                { n: "175+", l: t("Towers & sites") },
                { n: t("Local"), l: t("Support team") },
              ].map((s) => (
                <div key={s.l} className="glass rounded-2xl px-3 py-5">
                  <div className="text-2xl sm:text-3xl font-display font-extrabold site-hero-text leading-none mb-1.5">{s.n}</div>
                  <div className="text-[11px] uppercase tracking-widest text-muted2 font-bold">{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== Story panels (each features a real outdoor device) ===== */}
      <DevicePanel id="speed" device={<DishAntenna />}
        eyebrow={t("Point-to-point")} title={t("Long-range speed, locked on")}
        body={t("High-gain dish links carry fiber-grade throughput across kilometers — clear line-of-sight, low latency, rock-steady.")}
        glow="rgba(34,211,238,.16)" at="30% 40%" />

      <DevicePanel id="reliability" device={<Tower />} flip
        eyebrow={t("Backbone")} title={t("Tower to tower, always on")}
        body={t("A meshed backbone of towers and sector antennas reroutes around trouble, so your connection stays up day and night.")}
        glow="rgba(59,130,246,.16)" at="70% 40%" />

      <DevicePanel id="rooftop" device={<OutdoorUnit />}
        eyebrow={t("Your rooftop link")} title={t("The unit on your roof, dialed in")}
        body={t("We mount, aim and tune your outdoor receiver for the strongest signal, and we're one call away if it ever blinks.")}
        glow="rgba(167,139,250,.15)" at="30% 45%" />

      {/* ===== Coverage ===== */}
      <section id="coverage" data-panel className="panel">
        <Glow color="rgba(34,211,238,.16)" at="70% 50%" />
        <div className="w-full max-w-5xl mx-auto grid md:grid-cols-2 items-center gap-10 sm:gap-16">
          <Reveal className="flex justify-center md:order-2">
            <div className="text-cyan dev-float w-48 sm:w-64"><SectorAntenna /></div>
          </Reveal>
          <Reveal delay={150} className="text-center md:text-start md:order-1">
            <p className="text-cyan text-[11px] font-bold uppercase tracking-[0.3em] mb-3">{t("Coverage")}</p>
            <div className="text-5xl sm:text-6xl font-display font-extrabold site-hero-text leading-none mb-3">175+</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">{t("Towers across Mosul & Nineveh")}</h2>
            <p className="text-muted text-base sm:text-lg max-w-md md:max-w-none mb-6">{t("Our own towers and sector antennas cover neighborhoods across the city and the plains — and we light up new areas as we grow. A few of the areas we serve:")}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2.5">
              {areas.map((a) => (
                <span key={a} className="glass rounded-full px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5">
                  <span className="text-cyan"><Icon name="pin" className="w-4 h-4" /></span> {a}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== Contact ===== */}
      <section id="contact" data-panel className="panel fx-scene">
        <div className="fx-aurora" aria-hidden />
        <Reveal><span className="text-cyan text-[11px] font-bold uppercase tracking-[0.3em] mb-3 block">{t("Contact")}</span></Reveal>
        <Reveal delay={90}><h2 className="text-3xl sm:text-5xl font-extrabold mb-3">{t("Call us — we're local")}</h2></Reveal>
        <Reveal delay={170}>
          <p className="text-muted text-base sm:text-lg max-w-lg mb-9">{t("Give us a call or a WhatsApp and we'll check coverage at your address, then mount and aim your antenna — usually within a day or two.")}</p>
        </Reveal>
        <Reveal delay={240}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl w-full mb-10">
            {[
              { icon: "phone", label: t("Phone"), value: "+964 774 441 1788", href: "tel:+9647744411788" },
              { icon: "chat", label: t("WhatsApp"), value: "+964 774 441 1788", href: "https://wa.me/9647744411788" },
              { icon: "send", label: t("Telegram"), value: "@speednet_isp_95", href: "https://t.me/speednet_isp_95" },
              { icon: "mail", label: t("Email"), value: "info@speednet.iq", href: "https://mail.google.com/mail/?view=cm&fs=1&to=info@speednet.iq" },
              { icon: "pin", label: t("Office"), value: t("NINEVEH - MOSUL  ALNAJAR STREET "), href: "https://www.google.com/maps/search/?api=1&query=36.361942,43.097336" },
            ].map((c) => {
              const inner = (
                <>
                  <div className="text-cyan mb-2 flex justify-center"><Icon name={c.icon} /></div>
                  <div className="text-[9px] uppercase tracking-widest text-muted2 font-bold mb-0.5">{c.label}</div>
                  <div className="text-xs font-semibold break-words">{c.value}</div>
                </>
              );
              return c.href ? (
                <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer"
                  className="glass rounded-2xl p-4 hover:ring-1 hover:ring-cyan/40 transition">
                  {inner}
                </a>
              ) : (
                <div key={c.label} className="glass rounded-2xl p-4">{inner}</div>
              );
            })}
          </div>
        </Reveal>
        <Reveal delay={320}>
          <a href="#home" className="px-7 py-3 rounded-xl font-bold text-sm text-white"
            style={{ background: "var(--blue)" }}>
            {t("Back to top")}
          </a>
        </Reveal>
        <div className="mt-10 static sm:absolute sm:bottom-5 sm:mt-0 left-0 right-0 w-full flex items-center justify-center gap-3 text-muted2 text-xs px-4 flex-wrap">
          <span className="text-cyan font-extrabold">SPEEDNeT</span>
          <span>© {new Date().getFullYear()} · {t("All rights reserved.")}</span>
          <span className="text-muted2/70">
            {t("Developed by")}{" "}
            <a href="https://github.com/AbdalrhmanNashwan" target="_blank" rel="noopener noreferrer"
              className="text-cyan/90 hover:underline">Abdalrhman Nashwan</a>
            {" · "}
            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=abdalrhmannash.dev@gmail.com"
              target="_blank" rel="noopener noreferrer"
              className="text-cyan/90 hover:underline">abdalrhmannash.dev@gmail.com</a>
            {" · "}
            <a href="https://t.me/Abdalrhman20dev" target="_blank" rel="noopener noreferrer"
              className="text-cyan/90 hover:underline">@Abdalrhman20dev</a>
          </span>
        </div>
      </section>
    </>
  );
}
