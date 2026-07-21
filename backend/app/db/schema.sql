-- ============================================================================
--  SPEEDNeT ISP — Database Schema for Supabase (PostgreSQL)
--  ----------------------------------------------------------------------------
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  It creates all tables, relationships, indexes, and access rules.
--
--  Design:
--    towers            ← the parent. One row per tower/node.
--    links             ← PTP link radios            (FK → towers)
--    switches          ← managed switches/routers   (FK → towers)
--    sectors           ← sector / scatter APs       (FK → towers)
--    servers           ← internal servers           (FK → towers)
--    ip_allocations    ← upstream IP block registry (the "IP" sheet)
--    routing_points    ← agent routing tables       (the point-routing sheets)
--    subscribers       ← customer lists             (the البحيرات sheets)
--
--  Every device row carries tower_id, so "show everything under watani452"
--  becomes a single query, and every device knows which tower it belongs to.
-- ============================================================================

-- Clean slate (safe to re-run during setup; REMOVE these lines once you have
-- real data you don't want to lose).
drop table if exists links        cascade;
drop table if exists switches     cascade;
drop table if exists sectors      cascade;
drop table if exists servers      cascade;
drop table if exists ip_allocations cascade;
drop table if exists routing_points cascade;
drop table if exists subscribers  cascade;
drop table if exists towers       cascade;
drop table if exists zones        cascade;

-- ----------------------------------------------------------------------------
--  ZONES  (the top-level "bubbles" on the main page)
--  A zone groups many towers. SPEED is the company's own zone; سنوني is an
--  area zone. A zone can be filled automatically by a rule, by hand, or both.
-- ----------------------------------------------------------------------------
create table zones (
  id            bigint generated always as identity primary key,
  name          text not null,                  -- display name, e.g. "SPEED", "سنوني"
  description   text,
  color         text,                           -- bubble color (hex), optional
  sort_order    int default 0,                  -- controls bubble order on the page
  -- Optional auto-fill rule: if set, any tower matching is pulled into the zone.
  -- e.g. rule_field='reseller', rule_value='SPEEDNeT ISP'
  --      rule_field='area',     rule_value='سنوني'
  rule_field    text,                            -- 'reseller' | 'area' | null (manual only)
  rule_value    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

comment on table zones is 'Top-level bubbles on the main page. Group many towers.';

-- ----------------------------------------------------------------------------
--  TOWERS  (parent table)
-- ----------------------------------------------------------------------------
create table towers (
  id            bigint generated always as identity primary key,
  name          text not null,                 -- original sheet/tower name
  agent         text,                           -- اسم الوكيل
  agency_id     text,                           -- رقم الوكالة (e.g. bp-477)
  reseller      text,                           -- who operates it
  affiliate     text,                           -- upstream affiliate id
  phone         text,
  link_type     text,                           -- نوع اللنك
  switch_type   text,                           -- نوع السويج
  user_count    text,                           -- عدد اليوزرات (kept as text; some entries are notes)
  vlan          text,
  admin_page    text,                           -- صفحة الادمن
  admin_pass    text,                           -- باسورد الصفحة
  area          text,                           -- المنطقة
  zone_id       bigint references zones(id) on delete set null,  -- which bubble it belongs to
  gps_lat       text,
  gps_lng       text,
  height        text,                           -- ارتفاع
  parent_name   text,                           -- raw parent reference (topology)
  parent_id     bigint references towers(id) on delete set null,  -- resolved parent
  port          text,                           -- ether/sfp port on parent
  -- Service source — the four parts of a note like "328-bpwatani452-eth5-tag":
  -- model / source switch / port / tag mode. Used to trace outages upstream.
  -- (VLAN is the `vlan` column above — not duplicated here.)
  feed_model    text,                           -- switch model, e.g. 328
  fed_by        text,                           -- source switch, e.g. bpwatani452
  feed_port     text,                           -- port on that switch, e.g. eth5
  feed_mode     text,                           -- 'tag' | 'untag'
  status        text default 'Active',          -- Active / Down / Cancelled / Future ...
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

comment on table towers is 'One row per tower / node. Parent of all device tables.';

-- ----------------------------------------------------------------------------
--  LINKS  (PTP radios)
-- ----------------------------------------------------------------------------
create table links (
  id            bigint generated always as identity primary key,
  tower_id      bigint not null references towers(id) on delete cascade,
  ssid          text,
  device_name   text,
  device_type   text,                           -- devtype
  wireless_pass text,
  unlock_code   text,
  serial_number text,
  username      text,
  password      text,
  ip            text,
  gateway       text,
  subnet        text,
  mac_address   text,
  vlan          text,
  port          text,
  target        text,                           -- عنوان البرج (where it points)
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
--  SWITCHES
-- ----------------------------------------------------------------------------
create table switches (
  id            bigint generated always as identity primary key,
  tower_id      bigint not null references towers(id) on delete cascade,
  ip            text,
  username      text,
  password      text,
  model         text,
  gateway       text,
  subnet        text,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
--  SECTORS  (scatter / sector APs)
-- ----------------------------------------------------------------------------
create table sectors (
  id            bigint generated always as identity primary key,
  tower_id      bigint not null references towers(id) on delete cascade,
  ssid          text,
  device_name   text,
  device_type   text,                           -- devtype (Rocket M5, etc.)
  wireless_pass text,
  serial_number text,
  username      text,
  password      text,
  ip            text,
  gateway       text,
  subnet        text,
  mac_address   text,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
--  SERVERS  (internal NAS / app servers behind a tower)
-- ----------------------------------------------------------------------------
create table servers (
  id            bigint generated always as identity primary key,
  tower_id      bigint not null references towers(id) on delete cascade,
  device_name   text,
  username      text,
  password      text,
  url           text,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
--  IP_ALLOCATIONS  (upstream IP block registry — the "IP" sheet)
--  Not tied to a tower by FK because it references upstream provider accounts,
--  but owner / tower_ref are kept so you can join/search by name.
-- ----------------------------------------------------------------------------
create table ip_allocations (
  id            bigint generated always as identity primary key,
  owner         text,
  point         text,                           -- upstream account code
  tower_ref     text,                           -- associated tower (by name)
  tower_id      bigint references towers(id) on delete set null,  -- resolved if matched
  link_type     text,
  parent        text,
  vlan          text,
  ip_block      text,
  ip_master     text,
  user_master   text,
  pass_master   text,
  ip_slave      text,
  user_slave    text,
  pass_slave    text,
  sw_ip         text,
  sw_pass       text,
  rs_pass       text,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
--  ROUTING_POINTS  (agent-managed point routing tables)
--  These came from sheets like عمر عصر / محمد كتو / mshnet where one agent
--  manages many points. group_name = which agent sheet it came from.
-- ----------------------------------------------------------------------------
create table routing_points (
  id            bigint generated always as identity primary key,
  group_name    text not null,                  -- source agent/sheet
  owner         text,
  point         text,
  link_type     text,
  parent        text,
  vlan          text,
  ip_gateway    text,
  ip_master     text,
  user_master   text,
  pass_master   text,
  ip_slave      text,
  user_slave    text,
  pass_slave    text,
  sw_ip         text,
  sw_user       text,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
--  SUBSCRIBERS  (customer lists — البحيرات sheets)
-- ----------------------------------------------------------------------------
create table subscribers (
  id            bigint generated always as identity primary key,
  group_name    text,                           -- source list
  customer      text,
  username      text,
  exp_date      text,
  wakil         text,                           -- reseller/agent
  transfer      text,
  status        text,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================================
--  INDEXES  (make search and tower lookups fast)
-- ============================================================================
create index idx_links_tower    on links(tower_id);
create index idx_switches_tower on switches(tower_id);
create index idx_sectors_tower  on sectors(tower_id);
create index idx_servers_tower  on servers(tower_id);
create index idx_towers_parent  on towers(parent_id);
create index idx_towers_area     on towers(area);
create index idx_towers_reseller on towers(reseller);
create index idx_towers_zone     on towers(zone_id);

-- Full-text-ish search helpers (trigram) so "watani452" or partial IPs match fast.
create extension if not exists pg_trgm;
create index idx_towers_name_trgm   on towers   using gin (name gin_trgm_ops);
create index idx_links_ip_trgm      on links    using gin (ip gin_trgm_ops);
create index idx_sectors_ip_trgm    on sectors  using gin (ip gin_trgm_ops);
create index idx_switches_ip_trgm   on switches using gin (ip gin_trgm_ops);

-- ============================================================================
--  AUTO-UPDATE updated_at ON EVERY EDIT
-- ============================================================================
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['towers','links','switches','sectors','servers',
                           'ip_allocations','routing_points','subscribers','zones']
  loop
    execute format(
      'create trigger trg_touch_%1$s before update on %1$s
       for each row execute function touch_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
--  ROW LEVEL SECURITY
--  Policy you chose: any logged-in user can read AND edit everything.
--  Anonymous (not logged in) users get nothing.
-- ============================================================================
alter table zones           enable row level security;
alter table towers          enable row level security;
alter table links           enable row level security;
alter table switches        enable row level security;
alter table sectors         enable row level security;
alter table servers         enable row level security;
alter table ip_allocations  enable row level security;
alter table routing_points  enable row level security;
alter table subscribers     enable row level security;

-- One policy per table: authenticated users can do everything.
do $$
declare t text;
begin
  foreach t in array array['towers','links','switches','sectors','servers',
                           'ip_allocations','routing_points','subscribers','zones']
  loop
    execute format(
      'create policy "authenticated full access" on %1$s
       for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================================
--  CONVENIENCE VIEWS
-- ============================================================================
-- Tower with its device counts and zone name (handy for the dashboard).
create or replace view tower_overview as
select
  t.*,
  z.name as zone_name,
  (select count(*) from links    l where l.tower_id = t.id) as link_count,
  (select count(*) from switches s where s.tower_id = t.id) as switch_count,
  (select count(*) from sectors  c where c.tower_id = t.id) as sector_count
from towers t
left join zones z on z.id = t.zone_id;

-- Zone with rolled-up totals across all its towers — powers the main-page bubbles.
create or replace view zone_summary as
select
  z.id, z.name, z.description, z.color, z.sort_order,
  z.rule_field, z.rule_value,
  count(distinct t.id)                                          as tower_count,
  (select count(*) from links    l join towers tt on tt.id=l.tower_id where tt.zone_id=z.id) as link_count,
  (select count(*) from switches s join towers tt on tt.id=s.tower_id where tt.zone_id=z.id) as switch_count,
  (select count(*) from sectors  c join towers tt on tt.id=c.tower_id where tt.zone_id=z.id) as sector_count,
  (select count(*) from servers  v join towers tt on tt.id=v.tower_id where tt.zone_id=z.id) as server_count
from zones z
left join towers t on t.zone_id = z.id
group by z.id
order by z.sort_order, z.name;

-- Done. Next: load data (migration script), then build the admin page.
