import { test } from "node:test";
import assert from "node:assert/strict";
import { isSystemAdmin, resolveUserRoles, hasRequiredRole } from "../utils/rbac.js";
import { requireAuth } from "../middlewares/require-auth.js";
import { Role, SystemRole, type AuthUser } from "../types/rbac.js";
import type { Request, Response } from "express";

function createMockReq(user: AuthUser | null = null, authHeader?: string): Request {
  return {
    user,
    auth: user,
    get: (header: string) => (header.toLowerCase() === "authorization" ? authHeader : undefined),
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

test("isSystemAdmin identifies super admin and office users", () => {
  const superAdmin = createMockReq({
    userId: "1",
    userName: "connectadmin",
    roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.OFFICE_ADMIN],
    isOfficeUser: true,
    isSystemAdmin: true,
    position: null,
    jti: "test-jti-1",
    exp: 9999999999,
  });
  assert.equal(isSystemAdmin(superAdmin), true);

  const regularMember = createMockReq({
    userId: "2",
    userName: "OM2400663",
    roles: [Role.MEMBER, Role.PRESIDENT],
    isOfficeUser: false,
    position: { cmid: 1, desid: 101, orgid: 50 },
    jti: "test-jti-2",
    exp: 9999999999,
  });
  assert.equal(isSystemAdmin(regularMember), false);
});

test("resolveUserRoles correctly derives roles from office user status and positions", () => {
  // Office user
  const adminRoles = resolveUserRoles({ isOfficeUser: 1, role: "1" }, []);
  assert.ok(adminRoles.includes(Role.SUPER_ADMIN));
  assert.ok(adminRoles.includes(Role.ADMIN));
  assert.ok(adminRoles.includes(Role.OFFICE_ADMIN));
  assert.ok(adminRoles.includes(Role.MEMBER));

  // Committee member with president and secretary positions
  const memberRoles = resolveUserRoles(
    { isOfficeUser: 0, role: "" },
    [
      { designation: { name: "PRESIDENT" } },
      { designation: { name: "SECRETARY-ADMIN & IT" } },
    ],
  );
  assert.ok(memberRoles.includes("PRESIDENT"));
  assert.ok(memberRoles.includes("SECRETARY-ADMIN & IT"));
  assert.ok(memberRoles.includes("SECRETARY_ADMIN_IT"));
  assert.ok(memberRoles.includes("SECRETARY"));
  assert.ok(memberRoles.includes("CABINET"));
  assert.ok(memberRoles.includes("MEMBER"));
  assert.equal(memberRoles.includes("ADMIN"), false);
});

test("hasRequiredRole checks role membership accurately", () => {
  const roles = ["PRESIDENT", "CABINET", "MEMBER"];

  // Exact match
  assert.equal(hasRequiredRole(roles, "PRESIDENT"), true);
  // Array match where one matches
  assert.equal(hasRequiredRole(roles, ["SECRETARY", "PRESIDENT"]), true);
  // Case-insensitive / underscore match
  assert.equal(hasRequiredRole(["VICE_PRESIDENT", "MEMBER"], "VICE PRESIDENT"), true);
  // No match
  assert.equal(hasRequiredRole(roles, ["SECRETARY", "FINANCE_SECRETARY"]), false);
  // Super admin always allowed
  assert.equal(hasRequiredRole([Role.SUPER_ADMIN], "ANY_ROLE"), true);
});

test("requireAuth middleware blocks unauthenticated requests with 401", async () => {
  const req = createMockReq(null);
  const { res, statusCode } = createMockRes();
  let nextCalled = false;

  const middleware = requireAuth();
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
});

test("requireAuth(['ADMIN', 'PRESIDENT']) permits user holding PRESIDENT role", async () => {
  const req = createMockReq({
    userId: "2",
    userName: "OM2400663",
    roles: [Role.MEMBER, Role.PRESIDENT, Role.CABINET],
    role: "PRESIDENT",
    position: { cmid: 1, desid: 101, orgid: 50 },
    jti: "test-jti-3",
    exp: 9999999999,
  });
  const { res } = createMockRes();
  let nextCalled = false;

  const middleware = requireAuth(["ADMIN", "PRESIDENT"]);
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("requireAuth(['ADMIN', 'PRESIDENT']) rejects user holding only SECRETARY role with 403", async () => {
  const req = createMockReq({
    userId: "3",
    userName: "OM2400664",
    roles: [Role.MEMBER, Role.SECRETARY, Role.CABINET],
    role: "SECRETARY",
    position: { cmid: 2, desid: 105, orgid: 50 },
    jti: "test-jti-4",
    exp: 9999999999,
  });
  const mockRes = createMockRes();
  let nextCalled = false;

  const middleware = requireAuth(["ADMIN", "PRESIDENT"]);
  await middleware(req, mockRes.res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(mockRes.statusCode, 403);
});

test("requireAuth allows system admins to bypass role restrictions", async () => {
  const req = createMockReq({
    userId: "1",
    userName: "connectadmin",
    roles: [Role.SUPER_ADMIN, Role.ADMIN],
    isOfficeUser: true,
    isSystemAdmin: true,
    position: null,
    jti: "test-jti-5",
    exp: 9999999999,
  });
  const { res } = createMockRes();
  let nextCalled = false;

  const middleware = requireAuth(["SOME_RARE_ROLE"]);
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("requireAuth() without role parameters allows any authenticated user", async () => {
  const req = createMockReq({
    userId: "4",
    userName: "AE2414228",
    roles: [Role.MEMBER],
    position: null,
    jti: "test-jti-6",
    exp: 9999999999,
  });
  const { res } = createMockRes();
  let nextCalled = false;

  const middleware = requireAuth();
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});
