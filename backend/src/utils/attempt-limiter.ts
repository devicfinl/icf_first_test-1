// Throttles repeated failures against a single identity — someone working through passwords for
// one account. IP-based
// rate limiting (see middlewares/rate-limit.ts) does not cover this: an attacker can change IP,
// but not the account they are trying to get into.
//
// State is kept in memory: it is lost on restart and is not shared between processes, so running
// more than one instance weakens it proportionally. Move it to Redis or a table before scaling out.

export interface AttemptLimiterOptions {
  maxAttempts: number;
  windowMs: number;
}

export interface AttemptLimiter {
  /** True once the key has reached maxAttempts; clears itself windowMs after the last failure. */
  isLockedOut(key: string): boolean;
  recordFailure(key: string): void;
  clear(key: string): void;
  /** Seconds until a locked-out key is allowed to try again; 0 when it is not locked out. */
  retryAfterSeconds(key: string): number;
  /** Test seam: drops all state. */
  reset(): void;
}

interface Entry {
  attempts: number;
  expiresAt: number;
}

export function createAttemptLimiter({ maxAttempts, windowMs }: AttemptLimiterOptions): AttemptLimiter {
  const entries = new Map<string, Entry>();

  // Entries are only dropped when the limiter is next used, which is enough for a map keyed by
  // accounts that actually failed; there is no timer holding the process open.
  function sweep(): void {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
  }

  function current(key: string): Entry | undefined {
    sweep();
    return entries.get(key);
  }

  return {
    isLockedOut(key) {
      const entry = current(key);
      return !!entry && entry.attempts >= maxAttempts;
    },

    recordFailure(key) {
      sweep();
      const entry = entries.get(key);
      const expiresAt = Date.now() + windowMs;

      if (entry) {
        entry.attempts += 1;
        entry.expiresAt = expiresAt;
      } else {
        entries.set(key, { attempts: 1, expiresAt });
      }
    },

    clear(key) {
      entries.delete(key);
    },

    retryAfterSeconds(key) {
      const entry = current(key);
      if (!entry || entry.attempts < maxAttempts) return 0;
      return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    },

    reset() {
      entries.clear();
    },
  };
}
