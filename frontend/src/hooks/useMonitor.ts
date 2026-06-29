import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import api from "@/lib/api";
import type { MonitorResult, MonitorStatus, PingStatus } from "@/types";

// How often the UI re-fetches the cached status. The server pings on its own
// schedule; this just decides how quickly the dots update on screen.
const POLL_MS = 5000;

export function useMonitor() {
  return useQuery({
    queryKey: ["monitor"],
    queryFn: async () => (await api.get<MonitorStatus>("/monitor/status")).data,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}

function recompute(s: MonitorStatus, updated: MonitorResult): MonitorStatus {
  const results = s.results.map((r) => (r.ip === updated.ip ? updated : r));
  if (!results.some((r) => r.ip === updated.ip)) results.push(updated);
  const up = results.filter((r) => r.status === "up").length;
  const down = results.filter((r) => r.status === "down").length;
  return { ...s, results, total: results.length, up, down, unknown: results.length - up - down };
}

/** Force an immediate re-ping of one IP; patches the cached status in place. */
export function useForcePing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ip: string) =>
      (await api.post<MonitorResult>("/monitor/check", null, { params: { ip } })).data,
    onSuccess: (result) => {
      qc.setQueryData<MonitorStatus>(["monitor"], (old) =>
        old ? recompute(old, result) : old);
    },
  });
}

/**
 * Map of normalized-IP -> result, for inline status dots. Looking up by the raw
 * field value won't always match (the server normalizes), so callers should
 * pass an already-trimmed IP; we also index a few common variants.
 */
export function useIpStatusMap(): Map<string, PingStatus> {
  const { data } = useMonitor();
  return useMemo(() => {
    const m = new Map<string, PingStatus>();
    data?.results.forEach((r: MonitorResult) => m.set(r.ip, r.status));
    return m;
  }, [data]);
}
