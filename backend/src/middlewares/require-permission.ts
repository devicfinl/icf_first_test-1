import type { NextFunction, Request, Response } from "express";
import { isSystemAdmin } from "../utils/rbac.js";
import { sendError } from "../utils/response.js";
import {
  checkRolePermission,
  type PermissionAction,
} from "../modules/access-control/access-control.service.js";
import { AppModule, type AppModuleCode } from "../constants/modules.js";

export { AppModule, type AppModuleCode };

function forbidden(res: Response, message: string) {
  return sendError(res, 403, message);
}

function unauthorized(res: Response, message: string) {
  return sendError(res, 401, message);
}

/**
 * Route middleware enforcing dynamic role/designation-based access control.
 * Super Admins / Office Admins automatically bypass all restrictions.
 * Regular users are checked against their active designation (Secretary, Finance Secretary, President, etc.).
 */
export function requirePermission(moduleCode: AppModule | AppModuleCode, action: PermissionAction = "read") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. Ensure user is authenticated
    if (!req.user) {
      unauthorized(res, "Authentication required");
      return;
    }

    // 2. System Admins / Office Users bypass matrix restrictions
    if (isSystemAdmin(req)) {
      return next();
    }

    // 3. User's active designation / role
    const activeRole = req.user.role ?? null;
    const userRoles = req.user.roles ?? [];

    // 4. Check dynamic role permission with scope context
    try {
      const orgId = req.user.position?.orgid;
      const allowed = await checkRolePermission(activeRole, userRoles, moduleCode, action, { orgId });
      if (!allowed) {
        forbidden(
          res,
          `Access denied. Your role '${activeRole || "Member"}' does not have '${action}' permission for '${moduleCode}'.`,
        );
        return;
      }
      return next();
    } catch (err) {
      console.error(`Error verifying permission for module ${moduleCode}:`, err);
      forbidden(res, "Unable to verify permission");
      return;
    }
  };
}

export const canRead = (moduleCode: AppModule | AppModuleCode) => requirePermission(moduleCode, "read");
export const canCreate = (moduleCode: AppModule | AppModuleCode) => requirePermission(moduleCode, "create");
export const canUpdate = (moduleCode: AppModule | AppModuleCode) => requirePermission(moduleCode, "update");
export const canDelete = (moduleCode: AppModule | AppModuleCode) => requirePermission(moduleCode, "delete");
