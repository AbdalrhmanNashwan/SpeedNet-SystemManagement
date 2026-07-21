# Design: Port-level topology, VLANs, and agencies

Status: **Proposal / design doc** — no code written yet.
Author note: credit — Abdalrhman, Telegram @Abdalrhman20dev.

---

## 1. The problem

A tower's MikroTik/switch box (managed in Winbox) fans out over several ethernet
ports. Each port goes somewhere different, on a different VLAN:

- `ether1` → uplink to the parent tower
- `ether3` → an **agency** endpoint like `bpwatani450` (VLAN 450)
- `ether4` → a child tower
- `sfp1`   → switch-to-switch trunk

Today the schema can't say any of that. A tower has exactly **one** `port` text
field, **one** `parent_id`, and **one** `vlan` text field
(`backend/app/db/schema.sql`, `towers` table). So the moment a switch feeds more
than one thing, the only place to record it is a free-text `note` — which is why
the `الرفاعي المستقبل` note exists and why it feels wrong. It is wrong: it's data
trapped in prose that no query, map, or search can read.

A second, related confusion: **"is the port in or out?"** On a managed switch a
trunk port carries traffic *both ways at once* — that's normal, not a special
case. "Up vs down" is not a property of the port; it's derived from the topology
tree (your parent is up; everything below is down). So the model must **not**
store an in/out flag. It stores *what a port connects to* and *which VLANs ride
it*; direction falls out of the tree.

### What already exists (and why it's not enough)

`backend/app/models/misc.py` has a `BackboneFeed` table:

```
switch_name, switch_ip, port, feeds_name, feeds_tower_id, ssid, vlan, ip, model
```

This is the *right idea* — "this switch port feeds that downstream tower" — but
it's flat: the switch is a name string, not a real device+port, and it can't
express agencies, trunks carrying multiple VLANs, or port-to-port tracing. The
new model **subsumes and replaces** `BackboneFeed`.

---

## 2. How the industry models this

The standard source-of-truth tool for WISP/tower networks is **NetBox**. Its
model reduces to four ideas, all of which map cleanly onto this project:

| NetBox concept | What it is | Our equivalent |
|----------------|-----------|----------------|
| [Interface](https://netboxlabs.com/docs/netbox/models/dcim/interface/) | a physical port on a device | **`ports`** |
| [Cable](https://netboxlabs.com/docs/netbox/models/dcim/cable/) | joins port A ↔ port B, traceable | **`connections`** |
| VLAN | an L2 record, not a string | **`vlans`** |
| [Tenant](https://netboxlabs.com/docs/netbox/features/tenancy/) | a **customer/business entity**, separate from the network | **`agencies`** |

The key lesson from ISP deployments of NetBox
([ayuda.la](https://ayuda.la/en/blog/netbox-fuente-de-verdad-isp-en/),
[NetBox Tenancy](https://netboxlabs.com/docs/netbox/features/tenancy/)): a
**customer/agency is a different kind of thing from a VLAN.** A VLAN (450) is an
L2 construct; an agency (`bpwatani450`) is a business entity that *rides* a VLAN.
Keep them as separate records and link them. That's the decision for this design.

---

## 3. Proposed schema

Six new tables. **Additive** — nothing existing is dropped. Written to match the
existing `schema.sql` style (bigint identity PKs, `text` columns, `note`,
timestamps, cascade rules).

> **Winbox note.** Two of these tables (`bridges`, `port_vlans`) exist so the model
> mirrors RouterOS 1:1. In Winbox you don't set "a VLAN on a port" — you create a
> **bridge** with `vlan-filtering=yes`, add ports to it (each with a **PVID** =
> native/untagged VLAN), and fill the **Bridge VLAN Table** that says, per VLAN,
> which ports are *tagged* (trunk) and which *untagged* (access). `bridges` is that
> bridge; `ports.pvid` is the PVID; `port_vlans` **is** the Bridge VLAN Table.
> See [Bridge VLAN Table](https://help.mikrotik.com/docs/spaces/ROS/pages/28606465/Bridge+VLAN+Table).

```sql
-- ---------------------------------------------------------------------------
--  BRIDGES — the L2 domain you configure in Winbox (vlan-filtering on/off).
--  Ports join a bridge; the bridge is what you actually open and manage.
-- ---------------------------------------------------------------------------
create table bridges (
  id             bigint generated always as identity primary key,
  tower_id       bigint not null references towers(id) on delete cascade,
  device_kind    text,          -- 'switch' | 'router'
  device_id      bigint,        -- the row in switches/links it lives on
  name           text not null, -- 'bridge1'
  vlan_filtering boolean default true,
  protocol_mode  text,          -- 'rstp' | 'mstp' | 'none'
  note           text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index idx_bridges_tower on bridges(tower_id);

-- ---------------------------------------------------------------------------
--  PORTS — every physical port on any device becomes a row.
-- ---------------------------------------------------------------------------
create table ports (
  id           bigint generated always as identity primary key,
  tower_id     bigint not null references towers(id) on delete cascade,
  bridge_id    bigint references bridges(id) on delete set null, -- the bridge it belongs to
  device_kind  text,          -- 'switch' | 'link' | 'sector' | 'server' | 'router'
  device_id    bigint,        -- optional: the row in switches/links/sectors it lives on
  name         text not null, -- 'ether1', 'sfp1', 'wlan1'
  kind         text,          -- 'ethernet' | 'sfp' | 'wireless'
  role         text,          -- 'uplink' | 'downlink' | 'trunk' | 'access'  (a hint, not a direction)
  pvid         int,           -- native/untagged VLAN (Winbox PVID); default 1
  note         text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index idx_ports_tower on ports(tower_id);

-- ---------------------------------------------------------------------------
--  PORT_VLANS — the Bridge VLAN Table: which VLANs ride which port, tagged or not.
--  A trunk port has many rows (all tagged); an access port has one untagged row.
-- ---------------------------------------------------------------------------
create table port_vlans (
  port_id  bigint references ports(id) on delete cascade,
  vlan_id  bigint references vlans(id) on delete cascade,
  tagged   boolean default true,   -- tagged (trunk) vs untagged (access)
  primary key (port_id, vlan_id)
);

-- ---------------------------------------------------------------------------
--  CONNECTIONS — one link between two ports (or a port and an external agency).
--  This replaces backbone_feeds. Direction is NOT stored; it's derived.
-- ---------------------------------------------------------------------------
create table connections (
  id           bigint generated always as identity primary key,
  a_port_id    bigint not null references ports(id) on delete cascade,
  b_port_id    bigint references ports(id) on delete set null,  -- null when the far end is an agency
  agency_id    bigint references agencies(id) on delete set null, -- set when far end is an agency
  medium       text,          -- 'ethernet' | 'fiber' | 'ptp-wireless'
  note         text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index idx_conn_a on connections(a_port_id);
create index idx_conn_b on connections(b_port_id);

-- ---------------------------------------------------------------------------
--  VLANS — VLAN as a record, not a string.
-- ---------------------------------------------------------------------------
create table vlans (
  id        bigint generated always as identity primary key,
  vlan_id   int not null,     -- 450
  name      text,             -- 'watani450'
  note      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- NOTE: VLAN-on-a-connection is NOT stored. VLAN membership lives on the port
-- (port_vlans, above) because that's where Winbox puts it. What rides a
-- connection is DERIVED = the VLANs tagged/untagged on its two endpoint ports.

-- ---------------------------------------------------------------------------
--  AGENCIES — the downstream business entity (bpwatani450). Separate from VLAN.
-- ---------------------------------------------------------------------------
create table agencies (
  id            bigint generated always as identity primary key,
  code          text not null,   -- 'bpwatani450'
  name          text,            -- human name / reseller
  phone         text,
  vlan_id       bigint references vlans(id) on delete set null,  -- the VLAN it rides
  home_tower_id bigint references towers(id) on delete set null, -- where it lands
  status        text default 'Active',
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index idx_agencies_tower on agencies(home_tower_id);
```

### Relationship diagram

```
towers ──1:N── bridges ──1:N── ports ──┐
                                       ├──< connections >── ports  (port ↔ port link)
                                       │           │
                                       │           └── agencies    (port ↔ agency landing)
                                       │
                     ports ──N:M── vlans   (via port_vlans = Bridge VLAN Table)

connection VLANs = DERIVED from the two endpoint ports' port_vlans (not stored)

agencies ──N:1── vlans        (the VLAN an agency rides)
agencies ──N:1── towers       (its home tower)
```

---

## 4. The worked example: `الرفاعي المستقبل`

The note becomes real rows.

**Ports** (on الرفاعي's switch):

| name   | kind     | role     |
|--------|----------|----------|
| ether1 | ethernet | uplink   |
| ether3 | ethernet | access   |
| ether4 | ethernet | trunk    |
| sfp1   | sfp      | trunk    |

**Connections:**

| a_port | far end                    | medium       | VLANs (tagged) |
|--------|----------------------------|--------------|----------------|
| ether1 | parent tower `sfp1`        | ptp-wireless | 450, 452 (tag) |
| ether3 | agency `bpwatani450`       | ethernet     | 450 (untagged) |
| ether4 | child tower `X` `ether1`   | ethernet     | 452 (tag)      |

**Agency** `bpwatani450`: `code=bpwatani450`, `vlan_id → VLAN 450`,
`home_tower_id → الرفاعي المستقبل`.

Now:
- "show everything hanging off الرفاعي" = one query over `connections`.
- The map can draw real lines with VLAN labels.
- "in + out at once" is just `role='trunk'` — no contradiction.
- `bpwatani450` is searchable as an agency **and** as VLAN 450.

---

## 5. Migration plan (safe, staged)

Each stage is independently shippable; nothing breaks mid-way.

**Stage 1 — add tables.** New Alembic migration creating the five tables above.
No existing table touched. Ship.

**Stage 2 — backfill from current data.** A one-off script:
- For each tower with a `switch_type`/`port`, create the obvious `ports` rows.
- Turn each `towers.parent_id` into one `uplink` connection.
- Migrate every `backbone_feeds` row into a `connection` (+ create the ports it
  implies, resolve `vlan` into a `vlans` row).
- Parse `agency_id` / reseller strings like `bpwatani450` into `agencies` rows.
Everything unparseable is left as-is and flagged (same philosophy as the import
`flags` array) — a human decides, nothing is dropped.

**Stage 3 — backend.** SQLAlchemy models in a new `topology.py`, Pydantic
schemas, CRUD + routes under `/towers/{id}/ports` and `/connections`. Keep the
old `towers.port`/`vlan` fields readable during transition.

**Stage 4 — frontend.** A "Ports & connections" section on `TowerDetail`
(a table of ports, each showing what it connects to + its VLANs). Feed the
port-to-port links into `TowersMap` so the map draws the real backbone.

**Stage 5 — deprecate.** Once port data is trusted, retire `backbone_feeds` and
mark `towers.port`/`towers.vlan` as legacy (read-only, then removed).

---

## 6. Decisions locked in

- **The bridge is a first-class object.** A `bridges` row is what you open in
  Winbox; ports belong to a bridge and carry a `pvid`. The model mirrors RouterOS
  so a tech can read a screen and a row and see the same thing.
- **VLAN membership lives on the port** (`port_vlans` = the Bridge VLAN Table),
  tagged vs untagged. A connection's VLANs are **derived** from its two endpoint
  ports — never stored twice.
- **Agencies are their own records** that reference a VLAN — not modeled as a
  bare VLAN and not folded into `towers`. (NetBox Tenant-vs-VLAN pattern.)
- **No in/out flag on ports.** Direction ("coming from" / "going to") is derived
  by walking `connections`: up the uplink to the source, down every downlink to
  the leaves. `role` is only a human hint.
- **Additive migration.** `backbone_feeds` is superseded, not deleted, until its
  data is fully migrated.

## 7. How this shows up in the console

Grounded in how the reference tools (NetBox) present the same data, and mapped
onto this repo's actual seams.

**What the industry does (and we copy):**
- **Cable trace** — NetBox puts a "trace" button on a port and walks connected
  cables across pass-through ports to the far end, rendering the whole path. That
  *is* our "coming from / going to" walk over `connections`. Proven UX, not new.
  ([NetBox Cables](https://netboxlabs.com/docs/netbox/models/dcim/cable/))
- **Tagged/untagged per interface** — identical to `port_vlans` + `pvid`.
  ([NetBox Interfaces](https://netboxlabs.com/docs/netbox/models/dcim/interface/))
- **Data entry and topology are separate screens** — a ports *table* for editing,
  a *graph* for seeing. Don't fuse them.
  ([NetBox Visual Explorer](https://netboxlabs.com/blog/see-your-infrastructure-introducing-netbox-visual-explorer/))

**Frontend seam that makes this cheap:** `frontend/src/lib/deviceSections.ts`
(`DEVICE_SECTIONS`) is the single source of truth that both `TowerDetail` and the
global browse pages render as editable `DeviceTable`s. Ports drop straight into
that pattern.

**Phased plan:**
- **P1 — Ports as a device section.** Add a `ports` entry to `DEVICE_SECTIONS`
  (cols: `name · role · pvid · connects-to · vlans`). Instantly yields an editable
  ports table on every `TowerDetail` + a global browse page, reusing `DeviceTable`,
  `useDevices`, inline edit. Backend: this migration (done) + device-style routes.
- **P2 — Winbox panel + trace on `TowerDetail`.** Bridge card + tagged/untagged
  table (from the artifact), plus a "comes from / goes to" strip backed by one
  derived endpoint `GET /towers/{id}/trace` that walks `connections`.
- **P3 — Real backbone on the map.** Feed `connections` into `TowersMap` (it
  already hand-draws SVG) to draw port-to-port lines with VLAN labels. For an
  interactive zoom/drag graph, add a `Topology.tsx` page using **React Flow** —
  each tower a custom node, each connection an edge, click-to-trace highlighting.
  React Flow (not Cytoscape/vis-network) because our graphs are small (<5k nodes)
  and each node is a rich, clickable React card.
  ([React Flow vs Cytoscape](https://radar.firstaimovers.com/react-flow-vs-cytoscape-graph-engine-choice))
- **P4 — Sync from the router (the payoff).** `POST /towers/{id}/sync-from-router`
  reads the switch's stored creds → RouterOS REST API (`/interface/bridge`,
  `/interface/bridge/port` for PVID, `/interface/bridge/vlan` for tagged/untagged)
  → upserts `bridges`/`ports`/`port_vlans` and proposes `connections`. Data entry
  becomes review-and-confirm. Needs backend→device network reachability; confirm
  that path exists before building.
  ([RouterOS REST API](https://help.mikrotik.com/docs/spaces/ROS/pages/47579162/REST+API))

Status: **P1 backend shipped** — models (`app/models/topology.py`) + migration
`c3d4e5f6a7b8`. Next: device-style CRUD routes + the `ports` section in
`DEVICE_SECTIONS`.

## 8. Open questions for later

1. Should a `connection` allow more than two endpoints (a shared switch fabric),
   or is strict A↔B enough? (NetBox uses strict A↔B + pass-through ports. Start
   strict.)
2. Do agencies need subscriber counts / billing here, or does `subscribers`
   already cover that? (Probably link `subscribers.wakil` → `agencies.code`.)
3. IP allocation: should `ip_allocations` attach to a `port`/`connection` instead
   of a loose `tower_ref` string? (Likely yes, a later pass.)

---

Sources: [NetBox Interfaces](https://netboxlabs.com/docs/netbox/models/dcim/interface/),
[NetBox Cables](https://netboxlabs.com/docs/netbox/models/dcim/cable/),
[NetBox Tenancy](https://netboxlabs.com/docs/netbox/features/tenancy/),
[NetBox as ISP source of truth](https://ayuda.la/en/blog/netbox-fuente-de-verdad-isp-en/).
