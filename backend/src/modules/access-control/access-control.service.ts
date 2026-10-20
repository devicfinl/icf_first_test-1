import { prisma } from "../../db/index.js";

export type PermissionAction = "read" | "create" | "update" | "delete";

export interface CrudFlags {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface RoleDefinition {
  code: string;
  name: string;
  category: string;
  isCabinet: boolean;
}

export interface HierarchyLevelDefinition {
  level: number;
  name: string;
}

export interface ModulePermissionRow {
  moduleId: number;
  moduleCode: string;
  moduleName: string;
  category: string;
  parentCode: string | null;
  permissionsByRole: Record<string, CrudFlags>;
  inheritedFromGlobal?: Record<string, boolean>;
}

export interface AccessMatrixResponse {
  roles: RoleDefinition[];
  modules: ModulePermissionRow[];
  hierarchyLevels: HierarchyLevelDefinition[];
  scope: {
    hierarchyLevel: number;
    orgId: number;
  };
}

export interface PermissionUpdateItem {
  moduleId?: number;
  moduleCode?: string;
  role: string;
  hierarchyLevel?: number; // 0 = global / any level
  orgId?: number;          // 0 = global / any unit
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface ScopeContext {
  orgId?: number;
  hierarchyLevel?: number;
}

// In-memory cache to prevent database query on every protected HTTP call
// Key: `${roleKey}:${hierarchyLevel}:${orgId}` -> Map<moduleCode, CrudFlags>
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let scopedPermissionsCache: Map<string, Map<string, CrudFlags>> | null = null;
let allModulesCache: Array<{ id: number; code: string; name: string; category: string; parentCode: string | null }> | null = null;
const orgHlevelCache = new Map<number, number>();

export function invalidatePermissionsCache(): void {
  scopedPermissionsCache = null;
  allModulesCache = null;
  cacheTimestamp = 0;
  orgHlevelCache.clear();
}

/**
 * Returns the organizational hierarchy level (e.g. 7 for Division, 8 for Unit) for a given orgid.
 */
export async function getOrgHierarchyLevel(orgId: number): Promise<number | null> {
  if (!orgId || orgId <= 0) return null;
  if (orgHlevelCache.has(orgId)) {
    return orgHlevelCache.get(orgId)!;
  }
  const org = await prisma.organisationUnit.findUnique({
    where: { orgid: orgId },
    select: { hlevel: true },
  });
  if (org && org.hlevel !== null) {
    orgHlevelCache.set(orgId, org.hlevel);
    return org.hlevel;
  }
  return null;
}

/**
 * Returns all distinct system roles & committee designations.
 */
export async function getSystemRoles(): Promise<RoleDefinition[]> {
  const designations = await prisma.committeeDesignations.findMany({
    select: { desid: true, desigName: true, isCabinet: true },
    orderBy: [{ desigLevel: "asc" }, { desigName: "asc" }],
  });

  const seen = new Set<string>();
  const roles: RoleDefinition[] = [];

  // Core executive priorities
  const priorityOrder = [
    "PRESIDENT",
    "GENERAL SECRETARY",
    "FINANCE SECRETARY",
    "VICE PRESIDENT",
    "DEPUTY PRESIDENT",
  ];

  // 1. Core executive roles
  for (const prio of priorityOrder) {
    const match = designations.find((d) => d.desigName.trim().toUpperCase() === prio);
    if (match && !seen.has(prio)) {
      seen.add(prio);
      roles.push({
        code: prio,
        name: formatRoleName(prio),
        category: "Executive",
        isCabinet: true,
      });
    }
  }

  // 2. Generic Secretary umbrella role
  roles.push({
    code: "SECRETARY",
    name: "Secretary (All Secretaries)",
    category: "Executive",
    isCabinet: true,
  });
  seen.add("SECRETARY");

  // 3. Cabinet secretaries
  for (const d of designations) {
    const raw = d.desigName.trim();
    const upper = raw.toUpperCase();
    if (!seen.has(upper) && d.isCabinet === "Y" && upper.includes("SECRETARY")) {
      seen.add(upper);
      roles.push({
        code: upper,
        name: formatRoleName(raw),
        category: "Secretaries",
        isCabinet: true,
      });
    }
  }

  // 4. Other cabinet positions
  for (const d of designations) {
    const raw = d.desigName.trim();
    const upper = raw.toUpperCase();
    if (!seen.has(upper) && d.isCabinet === "Y") {
      seen.add(upper);
      roles.push({
        code: upper,
        name: formatRoleName(raw),
        category: "Cabinet Members",
        isCabinet: true,
      });
    }
  }

  // 5. Non-cabinet roles (Councillors, Senators, etc.)
  for (const d of designations) {
    const raw = d.desigName.trim();
    const upper = raw.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      roles.push({
        code: upper,
        name: formatRoleName(raw),
        category: "Council & Senate",
        isCabinet: false,
      });
    }
  }

  // 6. General Member
  roles.push({
    code: "MEMBER",
    name: "General Member",
    category: "General",
    isCabinet: false,
  });

  return roles;
}

/**
 * Returns available organization hierarchy tiers.
 */
export async function getHierarchyLevels(): Promise<HierarchyLevelDefinition[]> {
  const rows = await prisma.hierarchyName.findMany({
    where: { hlevel: { not: null } },
    orderBy: { hlevel: "asc" },
  });

  return rows.map((r) => ({
    level: r.hlevel!,
    name: r.hlevelname?.trim() || `Level ${r.hlevel}`,
  }));
}

/**
 * Searches organisations by keyword and optional level filter.
 */
export async function searchOrganisations(
  search?: string,
  level?: number,
): Promise<Array<{ orgid: number; orgname: string; hlevel: number | null }>> {
  const where: any = {};
  if (level && level > 0) {
    where.hlevel = level;
  }
  if (search && search.trim()) {
    where.orgname = { contains: search.trim() };
  }

  const orgs = await prisma.organisationUnit.findMany({
    where,
    select: { orgid: true, orgname: true, hlevel: true },
    orderBy: [{ hlevel: "asc" }, { orgname: "asc" }],
    take: 50,
  });

  return orgs.map((o) => ({
    orgid: o.orgid,
    orgname: o.orgname ?? `Org #${o.orgid}`,
    hlevel: o.hlevel,
  }));
}

function formatRoleName(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/\bIt\b/g, "IT")
    .replace(/\bPr\b/g, "PR")
    .replace(/\bHrd\b/g, "HRD")
    .replace(/\bSdc\b/g, "SDC")
    .replace(/\bIc\b/g, "IC");
}

function makeCacheKey(role: string, hierarchyLevel: number = 0, orgId: number = 0): string {
  return `${role.trim().toUpperCase()}:${hierarchyLevel || 0}:${orgId || 0}`;
}

async function loadPermissionsCache(): Promise<{
  cache: Map<string, Map<string, CrudFlags>>;
  modules: Array<{ id: number; code: string; name: string; category: string; parentCode: string | null }>;
}> {
  const now = Date.now();
  if (scopedPermissionsCache && allModulesCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return { cache: scopedPermissionsCache, modules: allModulesCache };
  }

  const [modules, perms] = await Promise.all([
    prisma.systemModule.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, code: true, name: true, category: true, parentCode: true },
    }),
    prisma.moduleRolePermission.findMany({
      select: {
        moduleId: true,
        role: true,
        hierarchyLevel: true,
        orgId: true,
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        module: {
          select: { code: true, parentCode: true },
        },
      },
    }),
  ]);

  const map = new Map<string, Map<string, CrudFlags>>();

  for (const p of perms) {
    const key = makeCacheKey(p.role, p.hierarchyLevel, p.orgId);
    if (!map.has(key)) {
      map.set(key, new Map());
    }
    const roleMap = map.get(key)!;
    roleMap.set(p.module.code, {
      read: p.canRead,
      create: p.canCreate,
      update: p.canUpdate,
      delete: p.canDelete,
    });
  }

  scopedPermissionsCache = map;
  allModulesCache = modules;
  cacheTimestamp = now;

  return { cache: map, modules };
}

/**
 * Returns the entire access control matrix for a given scope (global, tier, or specific unit).
 */
export async function getAccessControlMatrix(scope?: {
  hierarchyLevel?: number;
  orgId?: number;
}): Promise<AccessMatrixResponse> {
  const hLevel = Number(scope?.hierarchyLevel) || 0;
  const orgId = Number(scope?.orgId) || 0;

  const [roles, modules, hierarchyLevels, permissions] = await Promise.all([
    getSystemRoles(),
    prisma.systemModule.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    getHierarchyLevels(),
    prisma.moduleRolePermission.findMany({
      where: {
        OR: [
          // Current scope
          { hierarchyLevel: hLevel, orgId },
          // Global scope (for fallback comparison when in tier/unit mode)
          ...(hLevel > 0 || orgId > 0 ? [{ hierarchyLevel: 0, orgId: 0 }] : []),
        ],
      },
      select: {
        moduleId: true,
        role: true,
        hierarchyLevel: true,
        orgId: true,
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
    }),
  ]);

  // Index permissions by [moduleId][key]
  const scopedLookup = new Map<number, Map<string, CrudFlags>>();
  const globalLookup = new Map<number, Map<string, CrudFlags>>();

  for (const p of permissions) {
    const roleUpper = p.role.toUpperCase();
    const isGlobal = p.hierarchyLevel === 0 && p.orgId === 0;

    if (isGlobal) {
      if (!globalLookup.has(p.moduleId)) globalLookup.set(p.moduleId, new Map());
      globalLookup.get(p.moduleId)!.set(roleUpper, {
        read: p.canRead,
        create: p.canCreate,
        update: p.canUpdate,
        delete: p.canDelete,
      });
    }

    if (p.hierarchyLevel === hLevel && p.orgId === orgId) {
      if (!scopedLookup.has(p.moduleId)) scopedLookup.set(p.moduleId, new Map());
      scopedLookup.get(p.moduleId)!.set(roleUpper, {
        read: p.canRead,
        create: p.canCreate,
        update: p.canUpdate,
        delete: p.canDelete,
      });
    }
  }

  const isScopedView = hLevel > 0 || orgId > 0;

  const moduleRows: ModulePermissionRow[] = modules.map((mod) => {
    const permissionsByRole: Record<string, CrudFlags> = {};
    const inheritedFromGlobal: Record<string, boolean> = {};

    for (const r of roles) {
      const roleUpper = r.code.toUpperCase();
      const explicitScoped = scopedLookup.get(mod.id)?.get(roleUpper);
      const globalMatch = globalLookup.get(mod.id)?.get(roleUpper);

      if (explicitScoped) {
        permissionsByRole[r.code] = explicitScoped;
        inheritedFromGlobal[r.code] = false;
      } else if (isScopedView && globalMatch) {
        // Inherited from global rule
        permissionsByRole[r.code] = globalMatch;
        inheritedFromGlobal[r.code] = true;
      } else {
        permissionsByRole[r.code] = {
          read: false,
          create: false,
          update: false,
          delete: false,
        };
        inheritedFromGlobal[r.code] = false;
      }
    }

    return {
      moduleId: mod.id,
      moduleCode: mod.code,
      moduleName: mod.name,
      category: mod.category,
      parentCode: mod.parentCode,
      permissionsByRole,
      inheritedFromGlobal: isScopedView ? inheritedFromGlobal : undefined,
    };
  });

  return {
    roles,
    modules: moduleRows,
    hierarchyLevels,
    scope: { hierarchyLevel: hLevel, orgId },
  };
}

/**
 * Updates or creates permission entries for modules and roles within a scope.
 */
export async function saveRolePermissions(updates: PermissionUpdateItem[]): Promise<number> {
  if (updates.length === 0) return 0;

  const codeLookup = new Map<string, number>();
  const missingCodeModules = updates.filter((u) => !u.moduleId && u.moduleCode);
  if (missingCodeModules.length > 0) {
    const found = await prisma.systemModule.findMany({
      where: { code: { in: missingCodeModules.map((m) => m.moduleCode!) } },
      select: { id: true, code: true },
    });
    for (const f of found) {
      codeLookup.set(f.code, f.id);
    }
  }

  await prisma.$transaction(
    updates.map((item) => {
      const moduleId = item.moduleId ?? (item.moduleCode ? codeLookup.get(item.moduleCode) : undefined);
      if (!moduleId) {
        throw new Error(`Module identifier not found for item: ${JSON.stringify(item)}`);
      }

      const roleKey = item.role.trim().toUpperCase();
      const hierarchyLevel = item.hierarchyLevel ?? 0;
      const orgId = item.orgId ?? 0;

      return prisma.moduleRolePermission.upsert({
        where: {
          moduleId_role_hierarchyLevel_orgId: {
            moduleId,
            role: roleKey,
            hierarchyLevel,
            orgId,
          },
        },
        update: {
          canRead: item.canRead,
          canCreate: item.canCreate,
          canUpdate: item.canUpdate,
          canDelete: item.canDelete,
        },
        create: {
          moduleId,
          role: roleKey,
          hierarchyLevel,
          orgId,
          canRead: item.canRead,
          canCreate: item.canCreate,
          canUpdate: item.canUpdate,
          canDelete: item.canDelete,
        },
      });
    }),
  );

  invalidatePermissionsCache();
  return updates.length;
}

/**
 * Computes all module permissions for a user given their active role, scope context, and admin status.
 * Evaluates with cascading fallback: Unit -> Tier/Level -> Global -> Umbrella Secretary -> Deny.
 */
export async function computeUserPermissions(
  activeRole: string | null | undefined,
  userRoles: string[] = [],
  isSystemAdmin: boolean = false,
  context?: ScopeContext,
): Promise<Record<string, CrudFlags>> {
  const { cache, modules } = await loadPermissionsCache();

  const result: Record<string, CrudFlags> = {};

  if (isSystemAdmin) {
    for (const mod of modules) {
      result[mod.code] = {
        read: true,
        create: true,
        update: true,
        delete: true,
      };
    }
    return result;
  }

  // Derive scope identifiers
  const orgId = context?.orgId ?? 0;
  let hlevel = context?.hierarchyLevel ?? 0;
  if (!hlevel && orgId > 0) {
    hlevel = (await getOrgHierarchyLevel(orgId)) ?? 0;
  }

  // Candidate roles to check in priority order
  const candidates: string[] = [];
  if (activeRole) {
    candidates.push(activeRole.trim().toUpperCase());
  }
  for (const r of userRoles) {
    const upper = r.trim().toUpperCase();
    if (!candidates.includes(upper)) {
      candidates.push(upper);
    }
  }
  if (!candidates.includes("MEMBER")) {
    candidates.push("MEMBER");
  }

  // Build cascading search keys for a given role:
  // 1. (cand, hlevel, orgId)
  // 2. (cand, 0, orgId)
  // 3. (cand, hlevel, 0)
  // 4. (cand, 0, 0)
  function getSearchKeys(cand: string): string[] {
    const keys: string[] = [];
    if (orgId > 0 && hlevel > 0) keys.push(`${cand}:${hlevel}:${orgId}`);
    if (orgId > 0) keys.push(`${cand}:0:${orgId}`);
    if (hlevel > 0) keys.push(`${cand}:${hlevel}:0`);
    keys.push(`${cand}:0:0`);
    return keys;
  }

  for (const mod of modules) {
    let resolved: CrudFlags | null = null;

    // Check direct module permission across candidate roles with cascading scopes
    for (const cand of candidates) {
      const keys = getSearchKeys(cand);
      for (const k of keys) {
        const match = cache.get(k)?.get(mod.code);
        if (match !== undefined) {
          resolved = { ...match };
          break;
        }
      }
      if (resolved) break;
    }

    // Umbrella SECRETARY fallback
    if (!resolved && candidates.some((c) => c.includes("SECRETARY"))) {
      const secKeys = getSearchKeys("SECRETARY");
      for (const k of secKeys) {
        const match = cache.get(k)?.get(mod.code);
        if (match !== undefined) {
          resolved = { ...match };
          break;
        }
      }
    }

    // Submodule fallback to parent module
    if (!resolved && mod.parentCode) {
      for (const cand of candidates) {
        const keys = getSearchKeys(cand);
        for (const k of keys) {
          const parentMatch = cache.get(k)?.get(mod.parentCode);
          if (parentMatch !== undefined) {
            resolved = { ...parentMatch };
            break;
          }
        }
        if (resolved) break;
      }
    }

    result[mod.code] = resolved ?? {
      read: false,
      create: false,
      update: false,
      delete: false,
    };
  }

  return result;
}

/**
 * Evaluates whether a user's active role holds permission for a given module, action, and scope context.
 */
export async function checkRolePermission(
  activeRole: string | null | undefined,
  userRoles: string[] = [],
  moduleCode: string,
  action: PermissionAction,
  context?: ScopeContext,
): Promise<boolean> {
  const { cache, modules } = await loadPermissionsCache();

  // Scope context
  const orgId = context?.orgId ?? 0;
  let hlevel = context?.hierarchyLevel ?? 0;
  if (!hlevel && orgId > 0) {
    hlevel = (await getOrgHierarchyLevel(orgId)) ?? 0;
  }

  const candidates: string[] = [];
  if (activeRole) {
    candidates.push(activeRole.trim().toUpperCase());
  }
  for (const r of userRoles) {
    const upper = r.trim().toUpperCase();
    if (!candidates.includes(upper)) {
      candidates.push(upper);
    }
  }
  if (!candidates.includes("MEMBER")) {
    candidates.push("MEMBER");
  }

  function getSearchKeys(cand: string): string[] {
    const keys: string[] = [];
    if (orgId > 0 && hlevel > 0) keys.push(`${cand}:${hlevel}:${orgId}`);
    if (orgId > 0) keys.push(`${cand}:0:${orgId}`);
    if (hlevel > 0) keys.push(`${cand}:${hlevel}:0`);
    keys.push(`${cand}:0:0`);
    return keys;
  }

  // 1. Direct module check
  for (const cand of candidates) {
    const keys = getSearchKeys(cand);
    for (const k of keys) {
      const perm = cache.get(k)?.get(moduleCode);
      if (perm !== undefined) {
        return Boolean(perm[action]);
      }
    }
  }

  // 2. Umbrella SECRETARY fallback
  if (candidates.some((c) => c.includes("SECRETARY"))) {
    const secKeys = getSearchKeys("SECRETARY");
    for (const k of secKeys) {
      const perm = cache.get(k)?.get(moduleCode);
      if (perm !== undefined) {
        return Boolean(perm[action]);
      }
    }
  }

  // 3. Fallback to parent module
  const mod = modules.find((m) => m.code === moduleCode);
  if (mod?.parentCode) {
    for (const cand of candidates) {
      const keys = getSearchKeys(cand);
      for (const k of keys) {
        const parentPerm = cache.get(k)?.get(mod.parentCode);
        if (parentPerm !== undefined) {
          return Boolean(parentPerm[action]);
        }
      }
    }
  }

  return false;
}
