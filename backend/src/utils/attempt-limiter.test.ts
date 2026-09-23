import { test } from "node:test";
import assert from "node:assert/strict";
import { createAttemptLimiter } from "./attempt-limiter.js";

const MAX = 5;
const WINDOW_MS = 15 * 60 * 1000;

function limiter() {
  return createAttemptLimiter({ maxAttempts: MAX, windowMs: WINDOW_MS });
}

test("a key with no failed attempts is not locked out", () => {
  assert.equal(limiter().isLockedOut("someone"), false);
});

test("fewer than the max failures does not lock out", () => {
  const limit = limiter();
  for (let i = 0; i < MAX - 1; i++) limit.recordFailure("someone");
  assert.equal(limit.isLockedOut("someone"), false);
});

test("hitting the max failures locks the key out", () => {
  const limit = limiter();
  for (let i = 0; i < MAX; i++) limit.recordFailure("someone");
  assert.equal(limit.isLockedOut("someone"), true);
});

test("clear lifts a lockout", () => {
  const limit = limiter();
  for (let i = 0; i < MAX; i++) limit.recordFailure("someone");
  limit.clear("someone");
  assert.equal(limit.isLockedOut("someone"), false);
});

test("a lockout expires once the window passes", () => {
  // A window short enough to wait out without a timer, so the test stays fast and deterministic.
  const limit = createAttemptLimiter({ maxAttempts: MAX, windowMs: 1 });
  for (let i = 0; i < MAX; i++) limit.recordFailure("someone");
  assert.equal(limit.isLockedOut("someone"), true);

  const until = Date.now() + 5;
  while (Date.now() < until) {
    /* busy-wait past the 1ms window */
  }

  assert.equal(limit.isLockedOut("someone"), false);
});

test("keys are tracked independently", () => {
  const limit = limiter();
  for (let i = 0; i < MAX; i++) limit.recordFailure("locked");
  assert.equal(limit.isLockedOut("locked"), true);
  assert.equal(limit.isLockedOut("other"), false);
});

test("retryAfterSeconds is zero until locked out, then counts down the window", () => {
  const limit = limiter();
  assert.equal(limit.retryAfterSeconds("someone"), 0);

  for (let i = 0; i < MAX - 1; i++) limit.recordFailure("someone");
  assert.equal(limit.retryAfterSeconds("someone"), 0);

  limit.recordFailure("someone");
  const retryAfter = limit.retryAfterSeconds("someone");
  assert.ok(retryAfter > 0 && retryAfter <= WINDOW_MS / 1000, `unexpected retryAfter: ${retryAfter}`);
});

test("each failure extends the window from the latest attempt", () => {
  const limit = createAttemptLimiter({ maxAttempts: 2, windowMs: 60_000 });
  limit.recordFailure("someone");
  limit.recordFailure("someone");
  const first = limit.retryAfterSeconds("someone");

  limit.recordFailure("someone");
  assert.ok(limit.retryAfterSeconds("someone") >= first, "a further failure should not shorten the lockout");
});

test("reset drops all state", () => {
  const limit = limiter();
  for (let i = 0; i < MAX; i++) limit.recordFailure("a");
  for (let i = 0; i < MAX; i++) limit.recordFailure("b");
  limit.reset();
  assert.equal(limit.isLockedOut("a"), false);
  assert.equal(limit.isLockedOut("b"), false);
});
