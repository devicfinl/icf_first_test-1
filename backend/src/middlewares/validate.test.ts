import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

process.env.JWT_SECRET ??= "test-secret";

const { validate } = await import("./validate.js");
const { makeReq, makeRes, runMiddleware } = await import("../test/http.js");

const body = z.strictObject({
  name: z.string({ error: "Name is required." }).trim().min(1, "Name is required."),
  age: z.coerce.number().int().min(0).optional(),
});

test("a valid body passes through and replaces req.body with the parsed value", async () => {
  const req = makeReq({ body: { name: "  Ada  ", age: "36" } });
  const { calledNext } = await runMiddleware(validate({ body }), req, makeRes());

  assert.equal(calledNext, true);
  // Trimmed and coerced: the layers below get the cleaned value, not the raw one.
  assert.deepEqual(req.body, { name: "Ada", age: 36 });
  assert.deepEqual(req.validated?.body, { name: "Ada", age: 36 });
});

test("an invalid body is a 400 that never reaches the handler", async () => {
  const { calledNext, res } = await runMiddleware(
    validate({ body }),
    makeReq({ body: { name: "" } }),
    makeRes(),
  );

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.data, null);
  assert.equal(res.body.message, "Name is required.");
  assert.deepEqual(res.body.errors, [{ field: "body.name", message: "Name is required." }]);
});

test("unknown fields are rejected rather than quietly dropped", async () => {
  const { res } = await runMiddleware(
    validate({ body }),
    makeReq({ body: { name: "Ada", isAdmin: true } }),
    makeRes(),
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.errors[0].message, /unrecognized key/i);
});

test("every problem is reported at once, not one per round trip", async () => {
  const strict = z.strictObject({
    a: z.string({ error: "a is required." }),
    b: z.string({ error: "b is required." }),
  });

  const { res } = await runMiddleware(validate({ body: strict }), makeReq({ body: {} }), makeRes());

  assert.equal(res.statusCode, 400);
  assert.deepEqual(
    res.body.errors.map((e: { field: string }) => e.field),
    ["body.a", "body.b"],
  );
});

// req.query and req.params are getter-only in Express 5, so the parsed values have to go somewhere
// else. Assigning to them would throw at runtime.
test("query and params land on req.validated without being assigned back", async () => {
  const query = z.object({ page: z.coerce.number().int().min(1).default(1) });
  const params = z.object({ id: z.string().min(1) });

  const req = makeReq({ query: { page: "4" }, params: { id: "abc" } });
  const { calledNext } = await runMiddleware(validate({ query, params }), req, makeRes());

  assert.equal(calledNext, true);
  assert.deepEqual(req.validated?.query, { page: 4 });
  assert.deepEqual(req.validated?.params, { id: "abc" });
});

test("a defaulted query value is filled in when the parameter is absent", async () => {
  const query = z.object({ page: z.coerce.number().int().min(1).default(1) });

  const req = makeReq({ query: {} });
  await runMiddleware(validate({ query }), req, makeRes());

  assert.deepEqual(req.validated?.query, { page: 1 });
});

test("a missing body is treated as an empty object rather than crashing", async () => {
  const { res } = await runMiddleware(validate({ body }), makeReq({ body: undefined }), makeRes());

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Name is required.");
});
