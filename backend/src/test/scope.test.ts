import { test } from "node:test";
import assert from "node:assert/strict";
import { getOrgIdForFilter, isOrgInSubtree } from "../utils/scope.js";
import { SystemRole, type AuthUser } from "../types/rbac.js";
import type { Request } from "express";

function createMockReq(user: AuthUser | null, query: any = {}, body: any = {}): Request {
  return {
    user,
    auth: user,
    method: "GET",
    query,
    body,
  } as unknown as Request;
}

test("getOrgIdForFilter returns active orgId if no target specified", async () => {
  const req = createMockReq({
    userId: "2",
    userName: "OM001",
    name: "Leader",
    memberNo: "OM001",
    systemRole: SystemRole.MEMBER,
    isOfficeUser: false,
    jti: "jti-2",
    exp: 9999999999,
    position: {
      cmid: 1,
      desid: 101,
      orgid: 585,
    },
    activePosition: {
      cmid: 1,
      desid: 101,
      desigName: "PRESIDENT",
      orgId: 585,
      orgName: "Abu Dhabi Region",
      levelName: "Region",
    },
  });

  const orgId = await getOrgIdForFilter(req);
  assert.equal(orgId, 585);
});

test("getOrgIdForFilter allows system admin to access any target organization", async () => {
  const req = createMockReq(
    {
      userId: "1",
      userName: "connectadmin",
      name: "Admin",
      memberNo: "AE001",
      systemRole: SystemRole.SUPER_ADMIN,
      isOfficeUser: true,
      jti: "jti-1",
      exp: 9999999999,
      position: null,
      activePosition: null,
    },
    { orgId: "24533" },
  );

  const orgId = await getOrgIdForFilter(req);
  assert.equal(orgId, 24533);
});

test("getOrgIdForFilter rejects invalid non-integer orgId with 400", async () => {
  const req = createMockReq(
    {
      userId: "1",
      userName: "connectadmin",
      name: "Admin",
      memberNo: "AE001",
      systemRole: SystemRole.SUPER_ADMIN,
      isOfficeUser: true,
      jti: "jti-1",
      exp: 9999999999,
      position: null,
      activePosition: null,
    },
    { orgId: "invalid-id" },
  );

  await assert.rejects(
    async () => {
      await getOrgIdForFilter(req);
    },
    (err: any) => {
      return err.statusCode === 400;
    },
  );
});

test("isOrgInSubtree recognizes self as within subtree", async () => {
  const inSubtree = await isOrgInSubtree(585, 585);
  assert.equal(inSubtree, true);
});
