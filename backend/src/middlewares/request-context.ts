import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

// Tags each request with an id, echoes it back as X-Request-Id, and logs one line when the
// response finishes. The id is what ties a client's report of a failure to the server's log.
//
// Only the method, path, status and duration are logged. Bodies, query strings and headers are
// deliberately left out: they carry passwords, access codes and bearer tokens.
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("x-request-id");
  // An id from outside is echoed for tracing but kept short and boring, so it can't be used to
  // inject control characters into the log or oversize every line.
  const id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);

  if (env.nodeEnv === "test") return next();

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    // req.route?.path keeps ids out of the log; req.path is the fallback for unmatched routes.
    const path = req.baseUrl + (req.route?.path ?? req.path);
    console.log(`${id} ${req.method} ${path} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });

  next();
}
