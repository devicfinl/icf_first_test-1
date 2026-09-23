import { test, mock } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ??= "test-secret";

import { AppError } from "../../utils/app-error.js";

type FakePosition = {
  id: number;
  designation: { id: number; name: string; level: number };
  organisation: { id: number; name: string | null; level: string | null };
};

let positionsResult: FakePosition[] = [];
let listPositionsError: unknown = null;

let selectPositionResult: { token: string; position: FakePosition } | null = null;
let selectPositionError: unknown = null;

mock.module("./auth.service.js", {
  exports: {
    listPositions: async (_userId: string) => {
      if (listPositionsError) throw listPositionsError;
      return positionsResult;
    },
    selectPosition: async (_input: unknown) => {
      if (selectPositionError) throw selectPositionError;
      return selectPositionResult;
    },
  },
});

const { memberPositions, selectPosition } = await import("./auth.controller.js");
const { ACCESS_TOKEN_TTL_SECONDS } = await import("../../utils/jwt.js");
const { makeReq, makeRes } = await import("../../test/http.js");

const auth = (userId = "1") => ({ userId, jti: "jti", exp: 0, position: null });

const position: FakePosition = {
  id: 7,
  designation: { id: 1, name: "Secretary", level: 1 },
  organisation: { id: 2, name: "Kerala Zone", level: "Zone" },
};

test("memberPositions: without a token is a 401", async () => {
  const res = makeRes();
  await memberPositions(makeReq(), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test("memberPositions: returns the caller's committee positions", async () => {
  positionsResult = [position];
  listPositionsError = null;

  const res = makeRes();
  await memberPositions(makeReq({ auth: auth() }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.positions, [position]);
});

test("memberPositions: a disabled account surfaces the service's status code", async () => {
  listPositionsError = AppError.unauthorized("Your login is disabled");

  const res = makeRes();
  await memberPositions(makeReq({ auth: auth() }), res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Your login is disabled");
  listPositionsError = null;
});

test("selectPosition: without a token is a 401", async () => {
  const res = makeRes();
  await selectPosition(makeReq({ body: { positionId: position.id } }), res);
  assert.equal(res.statusCode, 401);
});

test("selectPosition: a chosen position returns a fresh token and the position", async () => {
  selectPositionResult = { token: "new-token", position };
  selectPositionError = null;

  const res = makeRes();
  await selectPosition(makeReq({ auth: auth(), body: { positionId: position.id } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.auth, {
    token: "new-token",
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
  });
  assert.deepEqual(res.body.data.position, position);
});

test("selectPosition: a position the caller does not hold is a 403", async () => {
  selectPositionError = AppError.forbidden("That committee position is not available to you.");

  const res = makeRes();
  await selectPosition(makeReq({ auth: auth(), body: { positionId: 999 } }), res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  selectPositionError = null;
});
