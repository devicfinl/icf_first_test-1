import { useCallback } from "react";
import { useAppContext } from "../context/AppContext";

export type PermissionAction = "read" | "create" | "update" | "delete";

/**
 * Hook to check permissions dynamically across the frontend UI.
 * Super Admins automatically satisfy any permission check.
 */
export function usePermissions() {
  const { session } = useAppContext();
  const isSystemAdmin = Boolean(session?.isSystemAdmin);
  const permissions = session?.permissions ?? {};

  const can = useCallback(
    (moduleCode: string, action: PermissionAction = "read"): boolean => {
      // Super admin bypasses all checks
      if (isSystemAdmin) return true;

      const mod = permissions[moduleCode];
      if (!mod) return false;

      return Boolean(mod[action]);
    },
    [isSystemAdmin, permissions],
  );

  const canRead = useCallback((moduleCode: string) => can(moduleCode, "read"), [can]);
  const canCreate = useCallback((moduleCode: string) => can(moduleCode, "create"), [can]);
  const canUpdate = useCallback((moduleCode: string) => can(moduleCode, "update"), [can]);
  const canDelete = useCallback((moduleCode: string) => can(moduleCode, "delete"), [can]);

  return {
    isSystemAdmin,
    permissions,
    can,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
  };
}
