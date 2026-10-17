import type { Request } from "express";
import { Role, type AuthUser } from "../types/rbac.js";

/**
 * Checks if the caller or user object has system-level administrator privileges.
 */
export function isSystemAdmin(reqOrUser: Request | AuthUser | null | undefined): boolean {
  if (!reqOrUser) return false;
  const user: AuthUser | undefined =
    "user" in reqOrUser ? (reqOrUser as Request).user : (reqOrUser as AuthUser);

  if (!user) return false;

  return (
    user.isSystemAdmin === true ||
    user.isOfficeUser === true ||
    user.roles?.includes(Role.SUPER_ADMIN) === true ||
    user.roles?.includes(Role.ADMIN) === true
  );
}

/**
 * Resolves all available roles for a user based on their account properties
 * and their assigned committee positions.
 */
export function resolveUserRoles(
  user: { role?: string | null; isOfficeUser?: number | null },
  positions: Array<{ designation?: { name?: string | null } | null }> = [],
): string[] {
  const rolesSet = new Set<string>();

  const isOffice = user.isOfficeUser === 1 || user.role === "1";
  if (isOffice) {
    rolesSet.add(Role.SUPER_ADMIN);
    rolesSet.add(Role.ADMIN);
    rolesSet.add(Role.OFFICE_ADMIN);
  }

  for (const pos of positions) {
    const raw = pos.designation?.name?.trim();
    if (!raw) continue;

    const upper = raw.toUpperCase();
    rolesSet.add(upper);

    // Normalized alphanumeric underscore representation (e.g. "GENERAL_SECRETARY", "SECRETARY_ADMIN_IT")
    const normalized = upper.replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    rolesSet.add(normalized);

    // If designation includes SECRETARY, grant the generic SECRETARY role
    if (upper.includes("SECRETARY")) {
      rolesSet.add(Role.SECRETARY);
    }

    // Default cabinet designation holds CABINET role
    rolesSet.add(Role.CABINET);
  }

  // Every verified user has MEMBER role
  rolesSet.add(Role.MEMBER);

  return Array.from(rolesSet);
}

/**
 * Checks if the user's available roles (or active role) satisfy any of the required roles.
 */
export function hasRequiredRole(
  userRoles: string[] = [],
  required: string | string[],
  activeRole?: string,
): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  if (requiredList.length === 0) return true;

  // Admins always have access
  if (
    userRoles.includes(Role.SUPER_ADMIN) ||
    userRoles.includes(Role.ADMIN)
  ) {
    return true;
  }

  return requiredList.some((reqRole) => {
    const normReq = reqRole.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

    if (activeRole) {
      const normActive = activeRole.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      return normActive === normReq || activeRole.toUpperCase() === reqRole.toUpperCase();
    }

    const matchesRoles = userRoles.some((uRole) => {
      const normUser = uRole.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      return normUser === normReq || uRole.toUpperCase() === reqRole.toUpperCase();
    });

    if (matchesRoles) return true;



    return false;
  });
}
