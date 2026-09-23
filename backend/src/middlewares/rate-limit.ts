import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../config/env.js";
import { sendError } from "../utils/response.js";

// Per-IP request limits. These blunt brute force and scraping; per-account lockout for repeated
// credential failures lives in utils/attempt-limiter.ts and covers the case where an attacker
// rotates IPs.
//
// Counts are held in memory, so each instance limits independently. Behind more than one instance,
// point express-rate-limit at a shared store (Redis) and set TRUST_PROXY so the client IP is real.
function limiter(max: number, message: string) {
  const handler: Options["handler"] = (_req, res) => sendError(res, 429, message);

  return rateLimit({
    windowMs: env.rateLimitWindowMs,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler,
  });
}

// Applied to everything, as a backstop against a client hammering the API.
export const apiRateLimit = limiter(
  env.rateLimitMax,
  "Too many requests. Please slow down and try again shortly.",
);

// Applied to the unauthenticated auth endpoints, where each request is a guess at a credential.
export const authRateLimit = limiter(
  env.authRateLimitMax,
  "Too many attempts. Please wait a few minutes and try again.",
);
