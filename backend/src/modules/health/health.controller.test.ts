import { test, mock } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ??= "test-secret";

let databaseReachable = true;

mock.module("./health.repository.js", {
  exports: {
    pingDatabase: async () => {
      if (!databaseReachable) throw new Error("ECONNREFUSED 127.0.0.1:3307");
    },
  },
});

const { health } = await import("./health.controller.js");
const { makeReq, makeRes } = await import("../../test/http.js");

test("a reachable database reports 200 and ok", async () => {
  databaseReachable = true;
  const res = makeRes();

  await health(makeReq(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.database, "connected");
  assert.equal(typeof res.body.uptime_seconds, "number");
});

// 503 rather than 500 on purpose: it tells a load balancer to take this instance out of rotation.
test("an unreachable database reports 503 so a probe stops sending traffic here", async () => {
  databaseReachable = false;
  const res = makeRes();

  await health(makeReq(), res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.status, "error");
  assert.equal(res.body.database, "unreachable");
});

test("the failure response carries nothing about why the database was unreachable", async () => {
  databaseReachable = false;
  const res = makeRes();

  await health(makeReq(), res);

  // A connection error naming hosts and ports is for the log, not for an unauthenticated caller.
  const serialised = JSON.stringify(res.body);
  assert.ok(!serialised.includes("ECONNREFUSED"), serialised);
  assert.ok(!serialised.includes("3307"), serialised);
});

test("the endpoint recovers once the database comes back", async () => {
  databaseReachable = false;
  await health(makeReq(), makeRes());

  databaseReachable = true;
  const res = makeRes();
  await health(makeReq(), res);

  assert.equal(res.statusCode, 200);
});
