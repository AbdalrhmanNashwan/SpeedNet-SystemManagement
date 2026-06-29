import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Device, DeviceType } from "@/types";

export function useDevices(type: DeviceType, towerId?: number) {
  return useQuery({
    queryKey: ["devices", type, towerId],
    queryFn: async () =>
      (await api.get<Device[]>(`/devices/${type}`, { params: { tower_id: towerId } })).data,
  });
}

export function useUpdateDevice(type: DeviceType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Device> }) =>
      (await api.patch<Device>(`/devices/${type}/${id}`, patch)).data,
    // optimistic: patch every cached devices list for this type, snapshot for rollback
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["devices", type] });
      const prev = qc.getQueriesData<Device[]>({ queryKey: ["devices", type] });
      qc.setQueriesData<Device[]>({ queryKey: ["devices", type] }, (old) =>
        old?.map((d) => (d.id === id ? { ...d, ...patch } : d)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Save failed — reverted");
    },
    onSuccess: () => toast.success("Saved"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["devices", type] }),
  });
}

export function useDeleteDevice(type: DeviceType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/devices/${type}/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices", type] }); toast.success("Deleted"); },
    onError: () => toast.error("Delete failed"),
  });
}

export function useTransferDevice(type: DeviceType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, to_type, to_tower_id }:
      { id: number; to_type?: DeviceType; to_tower_id?: number }) =>
      (await api.post(`/devices/${type}/${id}/transfer`, { to_type, to_tower_id })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); toast.success("Transferred"); },
    onError: () => toast.error("Transfer failed"),
  });
}

export function useCreateDevice(type: DeviceType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Device>) =>
      (await api.post<Device>(`/devices/${type}`, data)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices", type] }); toast.success("Row added"); },
    onError: () => toast.error("Add failed"),
  });
}
