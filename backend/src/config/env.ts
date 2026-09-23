import { z } from "zod";

// Every runtime setting the API reads, checked once at startup so a missing or malformed value
// fails immediately with a clear message instead of surfacing as a strange error mid-request.
const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is not set"),
  // How long a session token stays valid. Short by design: logout revokes a token, but the
  // denylist only has to remember it until it would expire anyway.
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  // membership_master.image_url holds only a file name; photos are served from this address.
  MEMBER_PHOTO_BASE_URL: z.string().default(""),
  // Browser origins allowed to call the API, comma separated. Empty means same-origin only,
  // which is what the dev setup uses (Vite proxies /api, so the browser never goes cross-origin).
  CORS_ORIGINS: z.string().default(""),
  // Express's trust proxy setting. Needed behind a load balancer so rate limiting keys on the
  // real client IP rather than the proxy's. "" off, "true" on, a number of hops, or "loopback".
  TRUST_PROXY: z.string().default(""),
  // Requests per window, per IP. The auth limiter below is deliberately much tighter.
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  // Largest JSON body accepted. This API only takes small objects, so the default is generous.
  JSON_BODY_LIMIT: z.string().default("100kb"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${details.join("\n")}`);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === "production";

// A guessable secret would let anyone mint a valid session token, so a real one is required
// where it matters. Development keeps whatever is set so a throwaway value still works.
if (isProduction && raw.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production (openssl rand -hex 32)");
}

function parseTrustProxy(value: string): boolean | number | string {
  if (value === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : value;
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction,
  port: raw.PORT,
  jwtSecret: raw.JWT_SECRET,
  accessTokenTtlSeconds: raw.ACCESS_TOKEN_TTL_MINUTES * 60,
  memberPhotoBaseUrl: raw.MEMBER_PHOTO_BASE_URL.replace(/\/+$/, ""),
  corsOrigins: raw.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  trustProxy: parseTrustProxy(raw.TRUST_PROXY),
  rateLimitWindowMs: raw.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  rateLimitMax: raw.RATE_LIMIT_MAX,
  authRateLimitMax: raw.AUTH_RATE_LIMIT_MAX,
  jsonBodyLimit: raw.JSON_BODY_LIMIT,
} as const;
