import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ??= "test-secret";

// requireLeader with the user cache on: repeated requests reach the database once per TTL, a
// disabled login set through this API is seen at once, and positions stay per user.

const queries = { count: 0 };
const users = new Map([
  [1, { id: 1, memberNo: "OM0000001", active: 1 }],
  [2, { id: 2, memberNo: "OM0000002", active: 1 }],
]);
const committee = new Map([
  [101, { cmemId: 1, cdesignId: 5, corgId: 70 }],
  [102, { cmemId: 2, cdesignId: 5, corgId: 70 }],
]);
const counted = <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => {
  queries.count += 1;
  return fn(...args);
};

mock.module("../../db/index.js", {
  exports: {
    prisma: {
      user: { findUnique: counted(async ({ where }: any) => users.get(where.id) ?? null) },
      membershipMaster: {
        findFirst: counted(async ({ where }: any) => ({ mid: Number(where.membershipNo.slice(-1)) })),
      },
      committeeMember: { findUnique: counted(async ({ where }: any) => committee.get(where.cmid) ?? null) },
      committeeDesignations: { findUnique: counted(async () => ({ isCabinet: "Y" })) },
    },
  },
});
mock.module("../../utils/reference-data.js", {
  exports: {
    organisationChain: async (id: number) => [{ id, name: "Unit", level: "Unit" }],
    resolveOrganisationSummaries: async () => new Map(),
  },
});

const { requireLeader } = await import("./pv.controller.js");
const { clearUserCache, invalidateUser } = await import("../../utils/user-cache.js");

const auth = (userId: number, cmid: number) =>
  ({ userId: String(userId), position: { cmid, desid: 5, orgid: 70 } }) as any;

beforeEach(() => {
  clearUserCache();
  queries.count = 0;
  users.get(1)!.active = 1;
});

test("repeated leader checks read the database once (4 queries), not on every request", async () => {
  for (let i = 0; i < 10; i += 1) await requireLeader(auth(1, 101));
  assert.equal(queries.count, 4);
});

test("a login disabled through this API is refused at once after invalidateUser", async () => {
  await requireLeader(auth(1, 101));
  users.get(1)!.active = 0;
  invalidateUser(1);
  await assert.rejects(requireLeader(auth(1, 101)), /Your login is disabled/);
});

test("one user's cached check is never used for another user's position", async () => {
  await requireLeader(auth(1, 101));
  // User 2 claiming user 1's position: user 2's own facts are loaded, and the check fails.
  await assert.rejects(requireLeader(auth(2, 101)), /cabinet|leader|position/i);
  assert.ok(await requireLeader(auth(2, 102)));
});
