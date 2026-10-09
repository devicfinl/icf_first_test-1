import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.JWT_SECRET ??= "test-secret";

type FakeUser = { id: number; userName: string; name: string; memberNo: string; password: string; active: number };

const users = new Map<number, FakeUser>();

// A stand-in Prisma client: only the queries cancel-account makes.
mock.module("../../db/index.js", {
  exports: {
    prisma: {
      user: {
        findUnique: async ({ where }: any) => users.get(where.id) ?? null,
        update: async ({ where, data }: any) => {
          Object.assign(users.get(where.id)!, data);
          return { id: where.id };
        },
      },
    },
  },
});

const { memberCancelAccount, cancelAccountBody } = await import("./auth.controller.js");
const { validate } = await import("../../middlewares/validate.js");
const { makeReq, makeRes, runMiddleware } = await import("../../test/http.js");
const { hashPassword } = await import("../../utils/password.js");
const { isTokenRevoked } = await import("../../utils/token-denylist.js");

const PASSWORD = randomUUID();
let nextId = 100;

async function seed() {
  const id = ++nextId;
  users.set(id, { id, userName: `OM${id}`, name: "Member", memberNo: `OM${id}`, password: await hashPassword(PASSWORD), active: 1 });
  return { userId: String(id), jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + 600, position: null };
}

test("the right password switches sign-in off and revokes the token, deleting nothing", async () => {
  const auth = await seed();
  const res = makeRes();

  await memberCancelAccount(makeReq({ auth, body: { currentPassword: PASSWORD, confirm: true } }), res);

  assert.equal(res.statusCode, 200);
  const user = users.get(Number(auth.userId));
  assert.ok(user, "the account row is kept");
  assert.equal(user.active, 0);
  assert.ok(isTokenRevoked(auth.jti));
});

test("a wrong password changes nothing", async () => {
  const auth = await seed();
  const res = makeRes();

  await memberCancelAccount(makeReq({ auth, body: { currentPassword: randomUUID(), confirm: true } }), res);

  assert.equal(res.statusCode, 401);
  assert.equal(users.get(Number(auth.userId))!.active, 1);
  assert.ok(!isTokenRevoked(auth.jti));
});

test("the request must explicitly confirm", async () => {
  for (const body of [{ currentPassword: PASSWORD }, { currentPassword: PASSWORD, confirm: false }]) {
    const { calledNext, res } = await runMiddleware(validate({ body: cancelAccountBody }), makeReq({ body }), makeRes());
    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 400);
  }
});
