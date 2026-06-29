import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Zone } from "@/types";

export function useZones() {
  return useQuery({
    queryKey: ["zones"],
    queryFn: async () => (await api.get<Zone[]>("/zones")).data,
  });
}

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Zone, "id">) => (await api.post<Zone>("/zones", data)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["zones"] }); toast.success("Zone created"); },
    onError: () => toast.error("Create failed"),
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Zone> }) =>
      (await api.patch<Zone>(`/zones/${id}`, patch)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["zones"] }); toast.success("Zone saved"); },
    onError: () => toast.error("Save failed"),
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/zones/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["zones"] }); toast.success("Zone deleted"); },
    onError: () => toast.error("Delete failed"),
  });
}
