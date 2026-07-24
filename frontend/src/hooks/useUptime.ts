import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export type UptimeItem = {
  ip: string;
  tower_id: number | null;
  tower_name: string | null;
  label: string | null;
  outages: number;
  downtime_seconds: number;
  uptime_pct: number;
  last_outage_at: string | null;
  ongoing: boolean;
};

export type OutageItem = {
  id: number;
  ip: string;
  tower_id: number | null;
  tower_name: string | null;
  label: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  ongoing: boolean;
};

export type UptimeResponse = {
  now: string;
  days: number;
  window_seconds: number;
  /** When outage monitoring first began. Uptime can only be measured from here. */
  monitoring_since: string;
  /** True when we have less history than the requested range. */
  partial_window: boolean;
  items: UptimeItem[];
};

/** Per-IP downtime totals over the last `days`, clipped to the time we've
 *  actually been monitoring. Only IPs that had an outage come back — everything
 *  else was at 100% by definition. */
export function useUptime(days: number) {
  return useQuery({
    queryKey: ["uptime", days],
    queryFn: async () =>
      (await api.get<UptimeResponse>("/monitor/uptime", { params: { days } })).data,
    refetchInterval: 60_000,
  });
}

/** Individual recorded outages, newest first. */
export function useOutages(days: number) {
  return useQuery({
    queryKey: ["outages", days],
    queryFn: async () =>
      (await api.get<{ outages: OutageItem[]; now: string }>(
        "/monitor/outages", { params: { days, limit: 300 } })).data,
    refetchInterval: 60_000,
  });
}
