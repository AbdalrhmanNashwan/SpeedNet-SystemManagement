# SPEEDNeT public corporate site (`/site`)

A bilingual (AR/EN), single-page marketing site for the company, **fully isolated**
from the admin console so it can be kept or deleted without touching the app.
It is experimental — treat it as disposable.

## Where it lives & how it's wired
- **Route:** the site is the **default** app at `/`. Served with its own chrome,
  **no console nav, no auth**. The admin console lives under **`/console`**.
- **Wiring:** `frontend/src/App.tsx` → `App()` decides by URL:
  ```ts
  const isConsole = path === "/console" || path.startsWith("/console/");
  return isConsole ? <ConsoleApp /> : <SiteApp />;
  ```
  `ConsoleApp` wraps the console in `<BrowserRouter basename="/console">`, so every
  console link/redirect (`to="/towers"`, `navigate("/")`, `<Navigate to="/login">`)
  resolves under `/console` automatically — no per-link changes. The site itself
  uses **no router** (anchor links only). Note: the raw 401 redirect in
  `src/lib/api.ts` is hardcoded to `/console/login`.
- **To make the console the default again:** in `App.tsx` swap the branch so `/`
  renders `ConsoleApp` (drop the basename) and move the site to e.g. `/site`.
- **To delete the whole site:** remove `frontend/src/site/`, make `App.tsx` render
  the console unconditionally, and (optionally) the site strings in `src/i18n/ar.ts`
  and the site CSS blocks in `src/styles/tokens.css`. Nothing else depends on it.

## Files (all under `frontend/src/site/`)
| File | Purpose |
|---|---|
| `SiteApp.tsx` | Site shell: sticky header (anchor nav, ع/EN toggle, theme toggle, "Customer Console" link back to `/`), the scroll-snap container, the scroll-driven 3D sphere, and renders `SiteLanding`. Publishes scroll progress as the `--scroll` CSS var (rAF-throttled). |
| `SiteLanding.tsx` | The one long page: full-screen panels (Hero → Speed → Reliability → Rooftop → Coverage → Contact). Also defines `DevicePanel`, `PanelDots` (right-side dots), and `Glow`. |
| `devices.tsx` | SVG line-art of generic outdoor gear: `OutdoorUnit` (rooftop CPE/receiver), `DishAntenna`, `SectorAntenna`, `Tower`. Stroke = `currentColor`; pulsing signal arcs via `.dev-wave`. **No brand names** — keep it generic. |
| `reveal.tsx` | `<Reveal>` scroll-reveal wrapper. One shared `IntersectionObserver` toggles `.is-visible`; **re-triggers** on every entry (the "Reels" replay feel). |
| `README.md` | This file. |

Shared from the console (do not duplicate): `@/i18n` (`useT`, `LanguageProvider`),
`@/components/LanguageToggle`, `@/components/ThemeToggle`, design tokens in
`@/styles/tokens.css`.

## Design / motion system (all in `src/styles/tokens.css`, search "Public corporate site")
- **Full-screen "Reels" panels:** `.site-reels` is the scroll container with
  `scroll-snap-type: y mandatory` (panels snap into place). `.panel` =
  `100dvh`, `scroll-snap-align: start`. NOTE: `scroll-snap-stop: always` was
  **removed on purpose** — it made scrolling feel "stuck". Keep it off.
- **Reveal:** `.reveal` starts `opacity:0; translateY(46px) scale(.92) blur(10px)`,
  transitions to `.is-visible`. Pure CSS transition; JS only toggles the class.
- **Scroll-linked 3D sphere:** `.scroll-scene` / `.scroll-orb`. A fixed wireframe
  network globe anchored to the **inline-end** side (auto-flips in RTL), partly
  off-edge, ~40% opacity. Outer wrapper rotates with `--scroll`
  (`rotateY(calc(var(--scroll,0) * 560deg))`); inner does a gentle idle spin.
  So scrolling visibly turns the globe → ties the panels together.
- **Device art:** `.dev-float` (gentle bob) + `.dev-wave` / `.w2` / `.w3`
  (staggered pulsing signal arcs).
- **Dots:** `.reels-dots` (fixed, inline-end). Active dot tracked by an
  IntersectionObserver in `PanelDots`.

## Performance principles (the reason it's built this way)
Stays fast on slow connections / weak devices:
- **No images, no video, no animation library, no new dependencies.** Only
  emoji, inline SVG, and CSS gradients.
- Motion = **CSS transitions/animations toggled by IntersectionObserver** (no
  scroll listeners driving layout). The only scroll handler writes a single CSS
  var, rAF-throttled, with **zero React re-renders**.
- Everything honors `prefers-reduced-motion` (reveals show instantly, snap and
  spins disabled).
- Heavy/3D bits are CSS transforms on the GPU.

## i18n (bilingual AR + EN, RTL)
- Uses the same engine as the console (`src/i18n/`). Wrap UI text in
  `t("English source string")`; Arabic lives in **`src/i18n/ar.ts`** (search
  the `// ---- Public corporate site (/site) ----` section). Missing keys fall
  back to English.
- The ع/EN toggle sets `<html dir="rtl">`; layout mirrors via **logical**
  Tailwind classes (`ms-`/`me-`, `start`/`end`, `inline-end`). When editing,
  prefer logical classes over `ml/mr/left/right` so RTL keeps working.

## Content status — PLACEHOLDERS to replace
Real values still need to be filled in (`SiteLanding.tsx`, Contact panel):
- Phone, WhatsApp: `+964 7XX XXX XXXX`
- Email: `info@speednet.iq`
- Office: "Main Street, City Center"
- Coverage area names (City Center, North/South District, Industrial Zone,
  University Area, Suburbs) — replace with real areas.
- Hero/stat numbers ("175+", "99.9%", "24/7") are illustrative.
- **Plans/prices were intentionally removed** — do not add a pricing section
  back unless asked.

## How to extend
- **New panel:** add a `<section data-panel id="x" className="panel">` (or a
  `<DevicePanel>`), then add `{ id: "x", label: t("…") }` to the `panels` array
  in `SiteLanding` so the dots/anchor nav include it.
- **New device drawing:** add an SVG component to `devices.tsx` (use the `Waves`
  helper for signal arcs, `currentColor` for stroke). Keep it brand-generic.
- **Keep it generic:** no specific product/brand names in copy or labels
  (general terms like "outdoor receiver", "dish antenna", "sector antenna").

## Gotchas
- Programmatic scrolling (`element.scrollTop = …`) fights the snap container in
  automation; real mouse/trackpad scrolling works fine. Use the dot buttons
  (`scrollIntoView`) or anchor links to jump.
- Screenshots taken right after load can catch reveals **mid-transition**
  (blurred/transparent) — that's expected, not a bug.
