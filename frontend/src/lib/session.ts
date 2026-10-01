import type { Session } from "../types/auth";

// The session lives in localStorage so it is shared by every tab and survives a reload or a closed
// tab, until sign-out or the token's expiry. sessionStorage was used before, but it is per tab: a
// new tab opened on the app's URL started with no session and landed on the sign-in screen.
//
// Storage is read fresh on every access instead of cached, so a token replaced in another tab
// (select-position, change-password) is the one this tab sends next.
//
// Storage can throw (private browsing, blocked site data), so every access is guarded and the app
// degrades to an in-memory session rather than failing to render.
const KEY = "icf.session";

let fallback: Session | null = null;
let onExpired: (() => void) | null = null;

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return fallback;
  }
}

export function getSession(): Session | null {
  return read();
}

export function getToken(): string | null {
  return read()?.token ?? null;
}

export function setSession(session: Session): void {
  fallback = session;
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Keeping `fallback` means the session still works for this page load.
  }
}

/** Replaces just the token, for the endpoints that hand back a fresh one. */
export function updateToken(token: string): void {
  const current = read();
  if (current) setSession({ ...current, token });
}

export function clearSession(): void {
  fallback = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: the in-memory copy is already gone.
  }
}

/**
 * Calls `handler` when another tab signs in, replaces the token, or signs out. The browser only
 * fires `storage` events in the tabs that did not make the change.
 */
export function onSessionChangedElsewhere(handler: (session: Session | null) => void): void {
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY && event.key !== null) return;
    handler(read());
  });
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
