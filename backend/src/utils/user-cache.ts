// A short-lived, in-memory cache for the facts the API reads about the signed-in user on almost
// every request (is the login active, which committee positions does the member hold). It lives in
// this process only, like the token denylist and the login attempt limiter: lost on restart and not
// shared between instances, which is fine for the single instance this API runs as. Move it to Redis
// before running more than one.
//
// Keys are namespaced per user, `user:{userId}:{name}`, and the userId always comes from the verified
// token, never from the request, so one user's entry can never be served to another.
//
// Accounts and positions are also changed outside this API (the office system), where nothing can
// clear this cache, so entries expire after USER_CACHE_TTL_SECONDS: a disabled login or a removed
// position stops working within that time. Changes made through this API clear the user's entries
// straight away (invalidateUser). A TTL of 0 turns the cache off.

import { env } from "../config/env.js";

type Entry = { value: unknown; expiresAt: number };

// The most entries kept: past it the oldest are dropped. A few per signed-in user.
const MAX_ENTRIES = 10_000;

const entries = new Map<string, Entry>();
// Loads in progress, so many requests that miss at once share one database read.
const loading = new Map<string, Promise<unknown>>();
// Bumped by invalidateUser, so a load that started before the change does not store stale data.
const generations = new Map<string, number>();

const keyFor = (userId: string | number, name: string) => `user:${userId}:${name}`;
const prefixFor = (userId: string | number) => `user:${userId}:`;

/**
 * The value stored under `name` for this user, or `load()`'s result, stored for the TTL.
 * A failed load is not stored: the error goes to the caller and the next request tries again.
 */
export async function cachedForUser<T>(
  userId: string | number,
  name: string,
  load: () => Promise<T>,
  ttlSeconds: number = env.userCacheTtlSeconds,
): Promise<T> {
  if (ttlSeconds <= 0) return load();

  const key = keyFor(userId, name);
  const entry = entries.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value as T;

  const pending = loading.get(key);
  if (pending) return pending as Promise<T>;

  const userKey = String(userId);
  const generation = generations.get(userKey) ?? 0;
  const promise = load()
    .then((value) => {
      if ((generations.get(userKey) ?? 0) === generation) store(key, value, ttlSeconds);
      return value;
    })
    .finally(() => loading.delete(key));
  loading.set(key, promise);
  return promise;
}

function store(key: string, value: unknown, ttlSeconds: number) {
  entries.delete(key);
  entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  // Map keeps insertion order, so the first keys are the oldest.
  for (const oldest of entries.keys()) {
    if (entries.size <= MAX_ENTRIES) break;
    entries.delete(oldest);
  }
}

/** Forgets everything cached for this user: call it whenever their account or positions change here. */
export function invalidateUser(userId: string | number): void {
  const userKey = String(userId);
  generations.set(userKey, (generations.get(userKey) ?? 0) + 1);
  const prefix = prefixFor(userId);
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}

/** Empties the whole cache (tests). */
export function clearUserCache(): void {
  entries.clear();
  loading.clear();
  generations.clear();
}
