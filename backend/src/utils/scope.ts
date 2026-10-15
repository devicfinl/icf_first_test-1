import type { Request } from "express";
import { prisma } from "../db/index.js";
import { AppError } from "./app-error.js";
import { isSystemAdmin } from "./rbac.js";
import { organisationChain } from "./reference-data.js";

/**
 * Extracts and verifies the target organization ID for request filtering.
 * If the user is System Admin, any target organization is allowed.
 * Otherwise, ensures target organization belongs to the caller's active subtree.
 */
export async function getOrgIdForFilter(
  req: Request,
  options: { paramName?: string; required?: boolean } = {},
): Promise<number | undefined> {
  const { paramName = "orgId", required = true } = options;

  const rawParam =
    req.method === "GET"
      ? req.query[paramName]
      : (req.body as Record<string, unknown> | undefined)?.[paramName];

  const targetOrgId =
    rawParam !== undefined && rawParam !== null && rawParam !== ""
      ? Number(rawParam)
      : undefined;

  if (targetOrgId !== undefined && (!Number.isInteger(targetOrgId) || targetOrgId <= 0)) {
    throw AppError.badRequest(`Invalid ${paramName} parameter`);
  }

  // System Administrators have unrestricted global scope
  if (isSystemAdmin(req)) {
    return targetOrgId ?? (req.user?.position?.orgid ?? req.user?.activePosition?.orgId);
  }

  const activeOrgId = req.user?.position?.orgid ?? req.user?.activePosition?.orgId;
  if (!activeOrgId) {
    if (required) {
      throw AppError.forbidden("No active organization position selected");
    }
    return undefined;
  }

  // If no specific downstream org requested, default to caller's own organization
  if (targetOrgId === undefined) {
    return activeOrgId;
  }

  // Verify that targetOrgId is inside the caller's organization branch
  const allowed = await isOrgInSubtree(activeOrgId, targetOrgId);
  if (!allowed) {
    throw AppError.forbidden("Requested organization is outside your administrative scope");
  }

  return targetOrgId;
}

/**
 * Verifies whether `targetOrgId` is equal to or subordinate to `parentOrgId`.
 * Uses the denormalized `organisation_hierarchy` table for O(1) ancestor lookups.
 */
export async function isOrgInSubtree(
  parentOrgId: number,
  targetOrgId: number,
): Promise<boolean> {
  if (parentOrgId === targetOrgId) {
    return true;
  }

  // 1. Check if targetOrgId is a Unit in organisation_hierarchy
  const unitHierarchy = await prisma.organisationHierarchy.findUnique({
    where: { unitId: targetOrgId },
  });

  if (unitHierarchy) {
    return (
      unitHierarchy.level1 === parentOrgId ||
      unitHierarchy.level2 === parentOrgId ||
      unitHierarchy.level3 === parentOrgId ||
      unitHierarchy.level6 === parentOrgId ||
      unitHierarchy.level7 === parentOrgId
    );
  }

  // 2. If target is an intermediate level (Division, Region, Chapter, National), check via ancestor chain
  const chain = await organisationChain(targetOrgId);
  return chain.some((node) => node.id === parentOrgId);
}
