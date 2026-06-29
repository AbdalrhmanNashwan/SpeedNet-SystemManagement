import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Tower } from "@/types";

export function useTowers(params?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ["towers", params],
    queryFn: async () => (await api.get<Tower[]>("/towers", { params })).data,
  });
}

export function useTower(id: number) {
  return useQuery({
    queryKey: ["tower", id],
    queryFn: async () => (await api.get<Tower>(`/towers/${id}`)).data,
    enabled: !!id,
  });
}

export function useUpdateTower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Tower> }) =>
      (await api.patch<Tower>(`/towers/${id}`, patch)).data,
    // optimistic: patch the single tower cache, snapshot for rollback
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["tower", id] });
      const prev = qc.getQueryData<Tower>(["tower", id]);
      if (prev) qc.setQueryData<Tower>(["tower", id], { ...prev, ...patch });
      return { prev, id };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tower", ctx.id], ctx.prev);
      toast.error("Save failed — reverted");
    },
    onSuccess: (t) => {
      qc.setQueryData(["tower", t.id], t);
      toast.success("Saved");
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["towers"] });
      qc.invalidateQueries({ queryKey: ["tower", vars.id] });
    },
  });
}

export function useCreateTower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Tower, "id">) => (await api.post<Tower>("/towers", data)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["towers"] }); toast.success("Tower created"); },
    onError: () => toast.error("Create failed"),
  });
}

export function useDeleteTower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/towers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["towers"] }); toast.success("Tower deleted"); },
    onError: () => toast.error("Delete failed"),
  });
}

/** Assign many towers to a zone in one action (sets each tower's zone_id). */
export function useAssignZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, zone_id }: { ids: number[]; zone_id: number | null }) => {
      await Promise.all(ids.map((id) => api.patch(`/towers/${id}`, { zone_id })));
    },
    onSuccess: (_d, { ids }) => {
      qc.invalidateQueries({ queryKey: ["towers"] });
      qc.invalidateQueries({ queryKey: ["zones"] });
      toast.success(`Moved ${ids.length} tower${ids.length !== 1 ? "s" : ""} to zone`);
    },
    onError: () => toast.error("Assign failed"),
  });
}
