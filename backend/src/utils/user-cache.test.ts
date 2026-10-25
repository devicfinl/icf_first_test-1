import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ??= "test-secret";

const { cachedForUser, invalidateUser, clearUserCache } = await import("./user-cache.js");

// A loader that counts how often it reaches the "database".
function counter<T>(value: () => T) {
  const calls = { count: 0 };
  const load = async () => {
    calls.count += 1;
    return value();
  };
  return { calls, load };
}

beforeEach(() => {
  clearUserCache();
  mock.timers.reset();
});

test("miss loads once; a hit within the TTL does not load again", async () => {
  const { calls, load } = counter(() => ({ active: 1 }));
  assert.deepEqual(await cachedForUser(1, "session", load, 60), { active: 1 });
  assert.deepEqual(await cachedForUser(1, "session", load, 60), { active: 1 });
  assert.equal(calls.count, 1);
});

test("an entry expires after its TTL and is loaded again", async () => {
  mock.timers.enable({ apis: ["Date"], now: 0 });
  const { calls, load } = counter(() => "x");
  await cachedForUser(1, "session", load, 60);
  mock.timers.tick(59_000);
  await cachedForUser(1, "session", load, 60);
  assert.equal(calls.count, 1);
  mock.timers.tick(1_000);
  await cachedForUser(1, "session", load, 60);
  assert.equal(calls.count, 2);
});

test("users are kept apart: one user's entry is never served to another", async () => {
  const one = await cachedForUser(1, "session", async () => "user one", 60);
  const two = await cachedForUser(2, "session", async () => "user two", 60);
  assert.equal(one, "user one");
  assert.equal(two, "user two");
  assert.equal(await cachedForUser(2, "session", async () => "reloaded", 60), "user two");
});

test("invalidateUser clears only that user's entries", async () => {
  const a = counter(() => "a");
  const b = counter(() => "b");
  await cachedForUser(1, "session", a.load, 60);
  await cachedForUser(1, "leader:5", a.load, 60);
  await cachedForUser(2, "session", b.load, 60);

  invalidateUser(1);
  await cachedForUser(1, "session", a.load, 60);
  await cachedForUser(1, "leader:5", a.load, 60);
  await cachedForUser(2, "session", b.load, 60);
  assert.equal(a.calls.count, 4);
  assert.equal(b.calls.count, 1);
});

test("requests that miss at once share one load (no stampede)", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const calls = { count: 0 };
  const load = async () => {
    calls.count += 1;
    await gate;
    return "value";
  };
  const all = Promise.all([1, 2, 3, 4, 5].map(() => cachedForUser(1, "session", load, 60)));
  release();
  assert.deepEqual(await all, ["value", "value", "value", "value", "value"]);
  assert.equal(calls.count, 1);
});

test("a failed load is not cached: the error reaches the caller and the next call retries", async () => {
  let fail = true;
  const load = async () => {
    if (fail) throw new Error("database down");
    return "ok";
  };
  await assert.rejects(cachedForUser(1, "session", load, 60), /database down/);
  fail = false;
  assert.equal(await cachedForUser(1, "session", load, 60), "ok");
});

test("a load that started before invalidateUser does not store its stale result", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const stale = cachedForUser(1, "session", async () => {
    await gate;
    return "stale";
  }, 60);
  invalidateUser(1);
  release();
  assert.equal(await stale, "stale");
  // Not stored: the next call loads the fresh value.
  assert.equal(await cachedForUser(1, "session", async () => "fresh", 60), "fresh");
});

test("a TTL of 0 turns the cache off", async () => {
  const { calls, load } = counter(() => "x");
  await cachedForUser(1, "session", load, 0);
  await cachedForUser(1, "session", load, 0);
  assert.equal(calls.count, 2);
});
