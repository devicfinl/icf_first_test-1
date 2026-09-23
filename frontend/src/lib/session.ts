import type { Session } from "../types/auth";

// The session lives in sessionStorage rather than localStorage on purpose: it is gone when the tab
// closes, which suits a 15-minute bearer token and keeps it off a shared machine after the fact.
//
// Storage can throw (private browsing, blocked site data), so every access is guarded and the app
// degrades to an in-memory session rather than failing to render.
const KEY = "icf.session";

let cached: Session | null = null;
let onExpired: (() => void) | null = null;

function read(): Session | null {
  if (cached) return cached;

  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    cached = JSON.parse(raw) as Session;
    return cached;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return read();
}

export function getToken(): string | null {
  return read()?.token ?? null;
}

export function setSession(session: Session): void {
  cached = session;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Keeping `cached` means the session still works for this page load.
  }
}

/** Replaces just the token, for the endpoints that hand back a fresh one. */
export function updateToken(token: string): void {
  const current = read();
  if (current) setSession({ ...current, token });
}

export function clearSession(): void {
  cached = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do: the in-memory copy is already gone.
  }
}

/**
 * Registered once at startup so the API client can tell the app its token stopped working,
 * without the client having to import the store (which would import the client right back).
 */
export function setOnExpired(handler: () => void): void {
  onExpired = handler;
}

export function notifyExpired(): void {
  onExpired?.();
}
