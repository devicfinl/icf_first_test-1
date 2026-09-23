import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { apiRateLimit } from "./middlewares/rate-limit.js";
import { requestContext } from "./middlewares/request-context.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { memberRouter } from "./modules/member/member.routes.js";
import { AppError } from "./utils/app-error.js";
import { sendError } from "./utils/response.js";

export const app = express();

// Behind a load balancer this is what makes req.ip the real client rather than the proxy, which
// rate limiting depends on. Left off by default: trusting proxy headers when nothing strips them
// would let any caller spoof their own address.
app.set("trust proxy", env.trustProxy);
// Don't advertise the framework.
app.disable("x-powered-by");

app.use(helmet());

// In dev the Vite proxy puts the app and the API on one origin, so no CORS headers are needed and
// CORS_ORIGINS is empty. Set it for a deployed build where the app is served from another origin.
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: same-origin, curl, or a server-to-server call. Nothing to approve.
      if (!origin) return callback(null, true);
      callback(null, env.corsOrigins.includes(origin.replace(/\/+$/, "")));
    },
    credentials: true,
    // So a browser can read the id it needs to quote when reporting a problem.
    exposedHeaders: ["X-Request-Id"],
  }),
);

app.use(requestContext);

// Health is mounted before the rate limiter so a load balancer's probe can't be throttled, and
// before the body parser because it takes no body.
app.use("/health", healthRouter);

app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(apiRateLimit);

app.use("/api/auth", authRouter);
app.use("/api/member", memberRouter);

app.use((_req: Request, res: Response) => {
  sendError(res, 404, "Not found");
});

// Express 5 forwards rejected promises from async handlers here automatically. Controllers
// normally translate their own failures (see utils/response.ts); this is the backstop for
// anything thrown outside one, and for the body parser's own errors.
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.details);
    return;
  }

  // express.json rejects unparseable or oversized bodies before any route runs.
  const type = (err as { type?: string })?.type;
  if (type === "entity.parse.failed") {
    sendError(res, 400, "Request body is not valid JSON.");
    return;
  }
  if (type === "entity.too.large") {
    sendError(res, 413, "Request body is too large.");
    return;
  }

  // Nothing about an unexpected failure goes back to the caller: the message can carry query
  // fragments, file paths or connection details. The request id ties this log line to their report.
  console.error(`${req.id ?? "-"} unhandled error:`, err);
  sendError(res, 500, "Internal server error");
};
app.use(errorHandler);
