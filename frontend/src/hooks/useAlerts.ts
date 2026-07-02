import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export type AlertEvent = {
  kind: "down" | "recovered" | "mass_outage";
  title: string;
  body: string;
  at: string;
  ip?: string;
  sources?: string[];
};

export type AlertFeed = {
  enabled: boolean;
  now?: string;
  config: {
    fail_threshold: number;
    recover_threshold: number;
    cooldown_minutes: number;
    mass_outage_ratio: number;
    mass_outage_min: number;
    webhook: boolean;
    email: boolean;
  };
  events: AlertEvent[];
  /** server_now − client_now at fetch time (ms); add to Date.now() so "ago"
   *  stays correct even when the client's clock is wrong. */
  skewMs: number;
};

const POLL_MS = 15000;

/** Poll the in-app alert feed. Open to every role; the backend scopes an
 *  agent's events to their own zone. `enabled` lets a caller pause polling. */
export function useAlerts(enabled: boolean) {
  return useQuery({
    queryKey: ["alerts"],
    enabled,
    queryFn: async (): Promise<AlertFeed> => {
      const { data } = await api.get<AlertFeed>("/monitor/alerts", { params: { limit: 100 } });
      const skewMs = data.now ? new Date(data.now).getTime() - Date.now() : 0;
      return { ...data, skewMs };
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}
