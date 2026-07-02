import { useAuth } from "./useAuth";
import type { Tower } from "@/types";

/**
 * Central place for "what can the current user do".
 *
 * Mirrors the backend: admins implicitly have every capability; everyone else
 * is governed by their can_create / can_update / can_delete flags. Viewing is
 * always allowed within the user's scope. Agents are additionally limited to
 * their own zone, so per-row writes must also pass `inScope(tower)`.
 */
export function usePerms() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const isAgent = user?.role === "agent";

  const canCreate = admin || !!user?.can_create;
  const canUpdate = admin || !!user?.can_update;
  const canDelete = admin || !!user?.can_delete;
  const canWrite = canCreate || canUpdate || canDelete;

  // A non-agent has company-wide scope; agents only touch their own zone.
  const inScope = (tower?: Tower | null) =>
    !isAgent || (!!tower && user?.zone_id === tower.zone_id);

  // Global registries (zones list edits, IP allocations) are off-limits to agents.
  const canSeeIpAllocations = admin || (!isAgent && canWrite);

  return {
    user, admin, isAgent,
    canCreate, canUpdate, canDelete, canWrite,
    canSeeIpAllocations, inScope,
  };
}
