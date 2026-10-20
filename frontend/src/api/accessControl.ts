import api, { unwrap } from "./axios";
import type { ApiEnvelope } from "../types/auth";

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

export interface OrganisationItem {
  orgid: number;
  orgname: string;
  hlevel: number | null;
}

export interface CrudFlags {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
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

export interface AccessMatrixData {
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
  hierarchyLevel?: number;
  orgId?: number;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export async function fetchAccessMatrix(params?: {
  hierarchyLevel?: number;
  orgId?: number;
}): Promise<AccessMatrixData> {
  const { data } = await api.get<ApiEnvelope<AccessMatrixData>>("/access-control/matrix", {
    params: {
      hierarchyLevel: params?.hierarchyLevel ?? 0,
      orgId: params?.orgId ?? 0,
    },
  });
  return unwrap(data);
}

export async function fetchSystemRoles(): Promise<RoleDefinition[]> {
  const { data } = await api.get<ApiEnvelope<{ roles: RoleDefinition[] }>>("/access-control/roles");
  const res = unwrap(data);
  return res.roles;
}

export async function searchOrganisations(params?: {
  search?: string;
  level?: number;
}): Promise<OrganisationItem[]> {
  const { data } = await api.get<ApiEnvelope<{ organisations: OrganisationItem[] }>>(
    "/access-control/organisations",
    { params },
  );
  const res = unwrap(data);
  return res.organisations;
}

export async function savePermissions(permissions: PermissionUpdateItem[]): Promise<{ count: number }> {
  const { data } = await api.post<ApiEnvelope<{ count: number }>>("/access-control/permissions", {
    permissions,
  });
  return unwrap(data);
}

export async function fetchMyPermissions(): Promise<{
  isSystemAdmin: boolean;
  permissions: Record<string, CrudFlags>;
}> {
  const { data } = await api.get<ApiEnvelope<{ isSystemAdmin: boolean; permissions: Record<string, CrudFlags> }>>(
    "/access-control/my-permissions",
  );
  return unwrap(data);
}
