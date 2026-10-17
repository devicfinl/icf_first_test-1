import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import { isTokenExpiredError, parseSessionPosition, verifyToken } from "../utils/jwt.js";
import { hasRequiredRole, isSystemAdmin } from "../utils/rbac.js";
import { sendError } from "../utils/response.js";
import { isTokenRevoked } from "../utils/token-denylist.js";
import { Role, SystemRole, type AuthUser } from "../types/rbac.js";

export interface AuthRequirements {
  /** If true, only Super Admins and Office Users can access this route */
  systemAdminOnly?: boolean;
  /** If true, requires user to hold a Cabinet committee position */
  cabinetOnly?: boolean;
  /** Required role or list of roles */
  roles?: string | string[];
}

export type RoleRequirement = string | string[] | AuthRequirements;

function unauthorized(res: Response, message: string) {
  return sendError(res, 401, message);
}

function forbidden(res: Response, message: string) {
  return sendError(res, 403, message);
}

/**
 * Core handler to authenticate the Bearer token and enforce role-based access.
 */
async function handleAuth(
  requirement: RoleRequirement | undefined,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {

  // If user is already authenticated on this request, proceed directly to role checking
  if (req.user && req.user.roles !== undefined) {
    return checkAccess(requirement, req, res, next);
  }

  const [scheme, token] = (req.get?.("authorization") ?? "").split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") {
    unauthorized(res, "Token not provided");
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (isTokenExpiredError(error)) {
      unauthorized(res, "Token already expired");
      return;
    }
    unauthorized(res, "Invalid token");
    return;
  }

  if (!payload.jti || !payload.exp || isTokenRevoked(payload.jti)) {
    unauthorized(res, "Token is no longer valid");
    return;
  }

  // Only session tokens open protected routes
  if (payload.purpose !== "access") {
    unauthorized(res, "Invalid token");
    return;
  }

  const isOffice =
    payload.isOfficeUser === true ||
    payload.isOfficeUser === 1 ||
    payload.role === "1";

  const tokenRoles: string[] = Array.isArray(payload.roles) ? payload.roles : [];
  const roles: string[] =
    tokenRoles.length > 0
      ? tokenRoles
      : isOffice
        ? [Role.SUPER_ADMIN, Role.ADMIN, Role.OFFICE_ADMIN, Role.MEMBER]
        : [Role.MEMBER];

  const authUser: AuthUser = {
    userId: String(payload.sub),
    userName: payload.userName,
    roles,
    role: payload.role ?? roles[0] ?? Role.MEMBER,
    position: parseSessionPosition(payload.position),
    isOfficeUser: isOffice,
    isSystemAdmin: isOffice || roles.includes(Role.SUPER_ADMIN) || roles.includes(Role.ADMIN),
    systemRole: isOffice ? SystemRole.OFFICE_ADMIN : SystemRole.MEMBER,
    jti: payload.jti,
    exp: payload.exp,
  };

  req.user = authUser;
  req.auth = authUser;
  checkAccess(requirement, req, res, next);
}

function checkAccess(
  requirement: RoleRequirement | undefined,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Unrestricted route: any authenticated caller allowed
  if (
    !requirement ||
    (Array.isArray(requirement) && requirement.length === 0) ||
    (typeof requirement === "object" && Object.keys(requirement).length === 0)
  ) {
    return next();
  }

  // System Administrators bypass role restrictions
  if (isSystemAdmin(req)) {
    return next();
  }

  // Handle classic array or string role requirement: requireAuth([role1, role2]) or requireAuth(role)
  if (typeof requirement === "string" || Array.isArray(requirement)) {
    const userRoles = req.user?.roles ?? [];
    const activeRole = req.user?.role;

    if (!hasRequiredRole(userRoles, requirement, activeRole)) {
      const requiredStr = Array.isArray(requirement) ? requirement.join(" or ") : requirement;
      forbidden(res, `Access denied. Required role: ${requiredStr}`);
      return;
    }
    return next();
  }

  // Handle configuration object: AuthRequirements
  if (typeof requirement === "object") {
    if (requirement.systemAdminOnly && !isSystemAdmin(req)) {
      forbidden(res, "Administrative privileges required");
      return;
    }

    if (requirement.cabinetOnly && !req.user?.roles?.includes(Role.CABINET)) {
      forbidden(res, "Active cabinet committee position required");
      return;
    }

    if (requirement.roles) {
      const userRoles = req.user?.roles ?? [];
      const activeRole = req.user?.role;
      if (!hasRequiredRole(userRoles, requirement.roles, activeRole)) {
        const requiredStr = Array.isArray(requirement.roles)
          ? requirement.roles.join(" or ")
          : requirement.roles;
        forbidden(res, `Access denied. Required role: ${requiredStr}`);
        return;
      }
    }
  }

  next();
}

/**
 * Unified authentication and classic role-based authorization middleware.
 * Supports:
 * - Direct middleware: `requireAuth`
 * - Parameterized role check: `requireAuth(['ADMIN', 'PRESIDENT'])` or `requireAuth('PRESIDENT')`
 * - Parameterized options: `requireAuth({ systemAdminOnly: true })`
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void>;
export function requireAuth(
  requirement?: RoleRequirement,
): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export function requireAuth(
  arg1?: Request | RoleRequirement,
  arg2?: Response,
  arg3?: NextFunction,
) {
  // TODO: remove after implementing rbac for all routes
  // Direct middleware usage: requireAuth(req, res, next)
  if (arg2 && arg3 && typeof arg1 === "object" && "get" in (arg1 as Request)) {
    return handleAuth(undefined, arg1 as Request, arg2, arg3);
  }

  // Invoked as factory: requireAuth(['ADMIN', 'PRESIDENT']) or requireAuth()
  const requirement = arg1 as RoleRequirement | undefined;
  return (req: Request, res: Response, next: NextFunction) =>
    handleAuth(requirement, req, res, next);
}
