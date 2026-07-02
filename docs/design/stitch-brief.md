I'm attaching screenshots of every screen in my product. Redesign the visual
style of each one — same structure, same fields, same tables, same buttons,
same functionality, only the look changes. This is a multi-screen product, so
before anything else, lock in a single design system below and apply it
**identically** to every screen. Do not reinterpret the style per screen —
reuse the exact same colors, type scale, spacing, radius, border, and
component styling on every single screen, including the nav bar, buttons,
inputs, tables, and status pills. If a color, spacing value, or component
style isn't specified below, match it to the closest thing already defined
here rather than inventing something new for that screen.

---

## What this is

**SPEEDNeT Console** — an internal admin dashboard for an Iraqi ISP managing
physical network infrastructure (towers, wireless links, switches, sector
antennas, servers, IP allocations) across zones. Used daily by network
engineers and admins on desktop. Alongside it is the company's public
marketing site (same brand, visitor-facing). One shared design system, two
different tones: console = restrained and functional, site = a little more
expressive, same underlying system.

## Locked design system — apply these values exactly, every screen

**Color (dark theme, default):**
- Background: `#101113`
- Panel / card surface: `#18191C`
- Raised panel (modals, dropdowns): `#1F2023`
- Border: `#2C2E33` (hairline, 1px, used everywhere instead of shadows)
- Primary text: `#F5F4F2`
- Secondary/muted text: `#A0A1A6`
- Tertiary/label text: `#6B6C71`
- **Brand accent (the only accent color, used sparingly): `#E08D3C`** — a
  warm copper/amber. Use it only for: primary buttons, active nav item,
  links, focus rings. Never use it decoratively (no accent gradients, no
  accent glows, no accent background washes on random cards).
- Status colors (semantic only, never used as decoration): success/up
  `#34D399`, danger/down `#F87171`, warning/unknown `#94A3B8` (a cool gray,
  deliberately NOT yellow, so it doesn't compete with the amber accent).

**Color (light theme):** same structure, inverted — background `#F7F6F4`,
panel `#FFFFFF`, border `#E3E1DD`, primary text `#17181B`, muted text
`#6B6C71`, same accent `#C97427` (slightly darker amber for contrast on
white), same status colors darkened ~10% for contrast.

**Typography:** UI text in **IBM Plex Sans** (or Inter if unavailable) —
regular 400 for body, medium 500 for labels/nav, semibold 600 only for page
titles and stat numbers. Never use bold 700+ or letter-spacing tricks to fake
hierarchy. Technical values (IPs, VLANs, MAC addresses, ports, GPS
coordinates, passwords) in **IBM Plex Mono**, always. Base body size 14px,
page titles 20–22px, stat numbers 28px. No text larger than that anywhere.

**Shape & elevation:** border-radius 8px on cards/inputs/buttons, 6px on
small pills/tags, never fully rounded "pill" buttons except status badges.
No drop shadows on cards — separate surfaces with the 1px border only. Modals
get one subtle shadow (`0 8px 24px rgba(0,0,0,.35)`), nothing else does.

**Buttons:** solid fill for primary actions using the accent color, plain
text or thin-border outline for secondary actions. No gradient fills on any
button, ever.

**Spacing:** use an 8px base scale (8/16/24/32/48px) consistently for
padding and gaps — no arbitrary spacing values.

## What to explicitly avoid (this is why the last attempt failed)

- No floating gradient orbs, glassmorphism, aurora blobs, glowing spheres, or
  any decorative background effects.
- No gradient text on headings.
- No rainbow UI — color only appears where it's semantic (status, one
  accent, nothing else).
- No template-y centered hero-icon-plus-headline blocks repeated on every
  screen — this is a dense data tool, design it like one.
- No drifting from the palette above on any single screen, even slightly —
  if you're unsure, reuse the exact hex value already used elsewhere rather
  than picking a nearby shade.

## Structural notes to preserve (from the screenshots)

Every console screen (once logged in) shares: a sticky top nav bar with the
brand wordmark, primary links (Towers, Links, Switches, Sectors, Monitor,
admin-only History/Users/Backups), a search field, notification bell,
language toggle (EN/Arabic, RTL), theme toggle, and signed-in user + sign
out. Reuse this exact nav — same markup, same colors — on every console
screen. Role-based UI (admin/editor/viewer/agent) hides actions a role can't
use rather than showing disabled buttons. Inline-editable fields, grouped
data tables, and the public site's full-height scroll sections with a side
progress indicator all keep their existing interaction pattern — restyle
only.

The site and console are fully bilingual (English/Arabic) with RTL layout
mirroring — design should work in both directions.

## After Stitch

Once every screen matches this system, I'll export and hand it to Claude
Code to implement — existing routes, data logic, and permissions stay
untouched in the codebase; only the visual layer (design tokens, Tailwind
classes, structural JSX where needed) gets replaced, one screen at a time,
using this exact palette and type system as the source of truth.
