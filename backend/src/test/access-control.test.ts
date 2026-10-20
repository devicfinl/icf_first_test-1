import { after, test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { requirePermission } from "../middlewares/require-permission.js";
import {
  computeUserPermissions,
  saveRolePermissions,
  checkRolePermission,
  invalidatePermissionsCache,
} from "../modules/access-control/access-control.service.js";
import { Role, type AuthUser } from "../types/rbac.js";
import { AppModule } from "../constants/modules.js";
import { prisma } from "../db/index.js";

after(async () => {
  await prisma.$disconnect();
});

function createMockReq(user: AuthUser | null = null): Request {
  return {
    user,
    auth: user,
    method: "GET",
    query: {},
    body: {},
  } as unknown as Request;
}

function createMockRes(): { res: Response; statusCode: number; body: any } {
  const result = {
    statusCode: 200,
    body: null as any,
    res: {} as Response,
  };

  result.res = {
    status(code: number) {
      result.statusCode = code;
      return result.res;
    },
    json(data: any) {
      result.body = data;
      return result.res;
    },
  } as unknown as Response;

  return result;
}

test("requirePermission blocks unauthenticated users with 401", async () => {
  const req = createMockReq(null);
  const { res } = createMockRes();
  let nextCalled = false;

  await requirePermission(AppModule.PV, "read")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
});

test("requirePermission allows Super Admins to bypass any module check", async () => {
  const req = createMockReq({
    userId: "1",
    userName: "connectadmin",
    roles: [Role.SUPER_ADMIN],
    isOfficeUser: true,
    isSystemAdmin: true,
    position: null,
    jti: "test-jti-admin",
    exp: 9999999999,
  });
  const { res } = createMockRes();
  let nextCalled = false;

  await requirePermission(AppModule.PV, "delete")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("requirePermission evaluates role permissions accurately", async () => {
  // Save permission: grant FINANCE SECRETARY read and create on PV
  await saveRolePermissions([
    {
      moduleCode: AppModule.PV,
      role: "FINANCE SECRETARY",
      canRead: true,
      canCreate: true,
      canUpdate: false,
      canDelete: false,
    },
  ]);

  // Request from a user acting as FINANCE SECRETARY
  const allowedReq = createMockReq({
    userId: "2",
    userName: "OM2400663",
    role: "FINANCE SECRETARY",
    roles: ["FINANCE SECRETARY", "SECRETARY", "MEMBER"],
    isOfficeUser: false,
    isSystemAdmin: false,
    position: { cmid: 1, desid: 101, orgid: 50 },
    jti: "test-jti-fin",
    exp: 9999999999,
  });

  let nextCalled = false;
  await requirePermission(AppModule.PV, "create")(allowedReq, createMockRes().res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);

  // But delete should be blocked
  const mockDelete = createMockRes();
  let nextDeleteCalled = false;
  await requirePermission(AppModule.PV, "delete")(allowedReq, mockDelete.res, () => {
    nextDeleteCalled = true;
  });
  assert.equal(nextDeleteCalled, false);
  assert.equal(mockDelete.statusCode, 403);
});

test("computeUserPermissions returns full CRUD for Super Admins", async () => {
  const perms = await computeUserPermissions("PRESIDENT", ["PRESIDENT"], true);
  assert.equal(perms[AppModule.PV].read, true);
  assert.equal(perms[AppModule.PV].create, true);
  assert.equal(perms[AppModule.PV].update, true);
  assert.equal(perms[AppModule.PV].delete, true);
  assert.equal(perms[AppModule.MEMBERS].read, true);
});

test("saveRolePermissions updates permissions and affects evaluation", async () => {
  // 1. Explicitly grant PV read & create for GENERAL SECRETARY
  await saveRolePermissions([
    {
      moduleCode: AppModule.PV,
      role: "GENERAL SECRETARY",
      canRead: true,
      canCreate: true,
      canUpdate: false,
      canDelete: false,
    },
  ]);

  const canReadResult = await checkRolePermission("GENERAL SECRETARY", ["GENERAL SECRETARY"], AppModule.PV, "read");
  const canCreateResult = await checkRolePermission("GENERAL SECRETARY", ["GENERAL SECRETARY"], AppModule.PV, "create");
  const canDeleteResult = await checkRolePermission("GENERAL SECRETARY", ["GENERAL SECRETARY"], AppModule.PV, "delete");

  assert.equal(canReadResult, true);
  assert.equal(canCreateResult, true);
  assert.equal(canDeleteResult, false);

  // 2. Now revoke PV create
  await saveRolePermissions([
    {
      moduleCode: AppModule.PV,
      role: "GENERAL SECRETARY",
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    },
  ]);

  const afterRevokeCreate = await checkRolePermission("GENERAL SECRETARY", ["GENERAL SECRETARY"], AppModule.PV, "create");
  assert.equal(afterRevokeCreate, false);
});

test("Scoped RBAC: evaluates unit, tier, and global rules in cascading priority", async () => {
  // Scenario:
  // 1. Global rule: SECRETARY-PR & MEDIA has NO delete access globally
  // 2. Tier rule: at Division level (hlevel = 7), SECRETARY-PR & MEDIA has delete access
  // 3. Unit rule: at specific unit (orgId = 999), SECRETARY-PR & MEDIA has create access specifically revoked

  await saveRolePermissions([
    {
      moduleCode: AppModule.PV,
      role: "SECRETARY-PR & MEDIA",
      hierarchyLevel: 0,
      orgId: 0,
      canRead: true,
      canCreate: true,
      canUpdate: false,
      canDelete: false,
    },
    {
      moduleCode: AppModule.PV,
      role: "SECRETARY-PR & MEDIA",
      hierarchyLevel: 7, // Division level
      orgId: 0,
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true, // granted for Division level!
    },
    {
      moduleCode: AppModule.PV,
      role: "SECRETARY-PR & MEDIA",
      hierarchyLevel: 0,
      orgId: 999, // specific unit
      canRead: true,
      canCreate: false, // explicitly revoked for unit 999
      canUpdate: false,
      canDelete: false,
    },
  ]);

  // A: User in generic unit (orgId = 50, not level 7)
  const userGlobalCanDelete = await checkRolePermission(
    "SECRETARY-PR & MEDIA",
    ["SECRETARY-PR & MEDIA"],
    AppModule.PV,
    "delete",
    { orgId: 50, hierarchyLevel: 8 }, // Unit level
  );
  assert.equal(userGlobalCanDelete, false, "Unit level user should not get delete (global default applies)");

  // B: User in Division tier (hierarchyLevel = 7)
  const divisionCanDelete = await checkRolePermission(
    "SECRETARY-PR & MEDIA",
    ["SECRETARY-PR & MEDIA"],
    AppModule.PV,
    "delete",
    { hierarchyLevel: 7 },
  );
  assert.equal(divisionCanDelete, true, "Division level user should get delete via tier rule");

  // C: User in unit 999
  const unit999CanCreate = await checkRolePermission(
    "SECRETARY-PR & MEDIA",
    ["SECRETARY-PR & MEDIA"],
    AppModule.PV,
    "create",
    { orgId: 999 },
  );
  assert.equal(unit999CanCreate, false, "Unit 999 user should have create blocked by specific unit rule");
});
