import type { NextFunction, Request, Response } from "express";
import { AppResponse } from "../../utils/app-response.js";
import { isSystemAdmin } from "../../utils/rbac.js";
import {
  computeUserPermissions,
  getAccessControlMatrix,
  getSystemRoles,
  saveRolePermissions,
  searchOrganisations,
  type PermissionUpdateItem,
} from "./access-control.service.js";
import { sendError } from "../../utils/response.js";

/**
 * GET /api/access-control/matrix?hierarchyLevel=0&orgId=0
 * Returns the entire permissions matrix for the specified scope.
 */
export async function getMatrix(req: Request, res: Response, next: NextFunction) {
  try {
    const hierarchyLevel = req.query.hierarchyLevel ? Number(req.query.hierarchyLevel) : 0;
    const orgId = req.query.orgId ? Number(req.query.orgId) : 0;
    const matrix = await getAccessControlMatrix({ hierarchyLevel, orgId });
    return next(new AppResponse("Access control matrix fetched successfully", matrix));
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/access-control/roles
 * Returns the list of available committee roles/designations.
 */
export async function getRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await getSystemRoles();
    return next(new AppResponse("System roles fetched successfully", { roles }));
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/access-control/organisations?search=...&level=...
 * Search organization units for scoping permissions to a specific unit.
 */
export async function getOrganisations(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const level = req.query.level ? Number(req.query.level) : undefined;
    const organisations = await searchOrganisations(search, level);
    return next(new AppResponse("Organisations fetched successfully", { organisations }));
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/access-control/permissions
 * Batch updates or saves CRUD permissions for modules, roles, and scopes.
 */
export async function updatePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const items = req.body?.permissions;
    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 400, "Expected a non-empty array of permissions in 'permissions' field");
    }

    const updates: PermissionUpdateItem[] = items.map((item: any) => ({
      moduleId: item.moduleId ? Number(item.moduleId) : undefined,
      moduleCode: item.moduleCode ? String(item.moduleCode) : undefined,
      role: String(item.role || item.roleCode),
      hierarchyLevel: item.hierarchyLevel !== undefined ? Number(item.hierarchyLevel) : 0,
      orgId: item.orgId !== undefined ? Number(item.orgId) : 0,
      canRead: Boolean(item.canRead),
      canCreate: Boolean(item.canCreate),
      canUpdate: Boolean(item.canUpdate),
      canDelete: Boolean(item.canDelete),
    }));

    const count = await saveRolePermissions(updates);
    return next(new AppResponse("Permissions updated successfully", { count }));
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/access-control/my-permissions
 * Returns the active user's computed permissions based on their active committee role and scope.
 */
export async function getMyPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const isAdmin = isSystemAdmin(req);
    const activeRole = req.user?.role ?? null;
    const userRoles = req.user?.roles ?? [];
    const orgId = req.user?.position?.orgid ?? 0;

    const permissions = await computeUserPermissions(activeRole, userRoles, isAdmin, { orgId });

    return next(
      new AppResponse("User permissions fetched successfully", {
        isSystemAdmin: isAdmin,
        activeRole,
        orgId,
        permissions,
      }),
    );
  } catch (err) {
    return next(err);
  }
}
