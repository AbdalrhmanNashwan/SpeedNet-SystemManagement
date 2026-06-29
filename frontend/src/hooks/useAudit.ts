import { useQuery, keepPreviousData } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AuditEntry } from "@/types";

export interface AuditFilters {
  entity?: string;
  action?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export function useAudit(filters: AuditFilters) {
  const { entity, action, q, limit = 100, offset = 0 } = filters;
  return useQuery({
    queryKey: ["audit", entity, action, q, limit, offset],
    queryFn: async () =>
      (await api.get<AuditEntry[]>("/audit", {
        params: {
          entity: entity || undefined,
          action: action || undefined,
          q: q || undefined,
          limit,
          offset,
        },
      })).data,
    placeholderData: keepPreviousData,
  });
}
