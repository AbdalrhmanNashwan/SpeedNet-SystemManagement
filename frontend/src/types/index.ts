export type Role = "admin" | "editor" | "viewer" | "agent";

export interface User {
  id: number; email: string; full_name: string | null;
  role: Role; zone_id: number | null; is_active: boolean;
  can_create: boolean; can_update: boolean; can_delete: boolean;
}

export interface Tower {
  id: number; name: string; agent?: string | null; agency_id?: string | null;
  reseller?: string | null; affiliate?: string | null; phone?: string | null;
  link_type?: string | null; switch_type?: string | null; user_count?: string | null;
  vlan?: string | null; admin_page?: string | null; admin_pass?: string | null;
  area?: string | null; gps_lat?: string | null; gps_lng?: string | null;
  height?: string | null; parent_name?: string | null; parent_id?: number | null;
  port?: string | null; status: string; notes?: string | null; zone_id?: number | null;
  // service source — parts of a note like "328-bpwatani452-eth5-tag"
  feed_model?: string | null; fed_by?: string | null;
  feed_port?: string | null; feed_mode?: string | null;
}

export type DeviceType = "links" | "switches" | "sectors" | "servers";

export interface Device {
  id: number; tower_id: number; flags: string[]; note?: string | null;
  ssid?: string | null; device_name?: string | null; device_type?: string | null;
  wireless_pass?: string | null; unlock_code?: string | null; serial_number?: string | null;
  mac_address?: string | null; username?: string | null; password?: string | null;
  ip?: string | null; gateway?: string | null; subnet?: string | null;
  vlan?: string | null; port?: string | null; target?: string | null;
  model?: string | null; url?: string | null;
}

export interface Zone {
  id: number; name: string; tag?: string | null; color?: string | null;
  icon?: string | null; sort_order?: number; rule_field?: string | null; rule_value?: string | null;
}

export interface AuditEntry {
  id: number;
  user_email: string | null;
  action: string;            // create | update | delete | transfer | recompute
  entity: string;            // tower | links | switches | sectors | zone | user | ip_allocation
  entity_id: number | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export interface IPAllocation {
  id: number;
  owner?: string | null; point?: string | null; tower_ref?: string | null;
  tower_id?: number | null; link_type?: string | null; parent?: string | null;
  vlan?: string | null; ip_block?: string | null;
  ip_master?: string | null; user_master?: string | null; pass_master?: string | null;
  ip_slave?: string | null; user_slave?: string | null; pass_slave?: string | null;
  sw_ip?: string | null; sw_pass?: string | null; rs_pass?: string | null;
  note?: string | null;
}

export type PingStatus = "up" | "down" | "unknown";

export interface MonitorRef {
  label: string;
  tower_id: number | null;
  tower?: string | null;     // tower name, for alert/popup context
  type: string | null;       // device section: links | switches | sectors | null
  device_id: number | null;
}

export interface MonitorResult {
  ip: string;
  status: PingStatus;
  latency_ms: number | null;
  packet_loss: number;
  last_checked: string;
  sources: string[];
  refs: MonitorRef[];
}

export interface MonitorStatus {
  enabled: boolean;
  running: boolean;
  cycle: number;
  total: number;
  up: number;
  down: number;
  unknown: number;
  sweep_started_at: string | null;
  sweep_completed_at: string | null;
  error: string | null;
  results: MonitorResult[];
}
