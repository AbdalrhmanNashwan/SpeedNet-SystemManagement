import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/hooks/useAuth";
import type { IPAllocation } from "@/types";

const KEY = ["ip-allocations"];

/**
 * IP allocation registry (the "IP" sheet). The endpoint is editor+ only because
 * these rows carry master/slave credentials, so the query is disabled for
 * viewers/agents (it would 403).
 */
export function useIpAllocations() {
  const { user } = useAuth();
  const allowed = user?.role === "admin" || user?.role === "editor";
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<IPAllocation[]>("/ip-allocations")).data,
    enabled: allowed,
  });
}

export function useUpdateIpAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<IPAllocation> }) =>
      (await api.patch<IPAllocation>(`/ip-allocations/${id}`, patch)).data,
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<IPAllocation[]>(KEY);
      qc.setQueryData<IPAllocation[]>(KEY, (old) =>
        old?.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); toast.error("Save failed — reverted"); },
    onSuccess: () => toast.success("Saved"),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateIpAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<IPAllocation>) =>
      (await api.post<IPAllocation>("/ip-allocations", data)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Row added"); },
    onError: () => toast.error("Add failed"),
  });
}

export function useDeleteIpAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/ip-allocations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Deleted"); },
    onError: () => toast.error("Delete failed"),
  });
}
