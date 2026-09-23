import axios, { AxiosError } from "axios";
import type { ApiEnvelope } from "../types/auth";
import { clearSession, getToken, notifyExpired } from "../lib/session";

// In dev this is left unset and Vite proxies /api to the backend, so the browser stays on one
// origin. A deployed build sets VITE_API_BASE_URL to the API's own origin.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

// The API authenticates with a bearer token, not a cookie, so every request carries the header.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    // 401 means this token is finished — expired, revoked by a sign-out elsewhere, or replaced by
    // select-position / change-password. Drop it so the app stops sending a token it knows is dead.
    if (error.response?.status === 401) {
      clearSession();
      notifyExpired();
    }
    return Promise.reject(error);
  },
);

/**
 * The message to show a user for a failed request. The API puts a human-readable sentence in
 * `message`, so that is preferred over anything axios invents.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const err = error as AxiosError<ApiEnvelope<unknown>>;

  if (err?.response?.data?.message) return err.response.data.message;
  // No response at all: the API is down, or the dev server is running without the backend.
  if (err?.request) return "Could not reach the server. Please check your connection and try again.";

  return fallback;
}

/**
 * Unwraps the success envelope. The API only sets `success: false` alongside a non-2xx status,
 * so reaching here with a null `data` means the response did not look the way we expect.
 */
export function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope?.success || envelope.data === null || envelope.data === undefined) {
    throw new Error(envelope?.message || "Unexpected response from the server.");
  }
  return envelope.data;
}

export default api;
