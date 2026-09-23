import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import { isTokenExpiredError, parseSessionPosition, verifyToken } from "../utils/jwt.js";
import { sendError } from "../utils/response.js";
import { isTokenRevoked } from "../utils/token-denylist.js";

function unauthorized(res: Response, message: string) {
  return sendError(res, 401, message);
}

// Rejects requests without a valid, unrevoked Bearer token; put it before any protected route.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const [scheme, token] = (req.get("authorization") ?? "").split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") {
    return unauthorized(res, "Token not provided");
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (isTokenExpiredError(error)) {
      return unauthorized(res, "Token already expired");
    }
    return unauthorized(res, "Invalid token");
  }

  if (!payload.jti || !payload.exp || isTokenRevoked(payload.jti)) {
    return unauthorized(res, "Token is no longer valid");
  }

  // Only session tokens open protected routes; anything else signed with the same secret is refused.
  if (payload.purpose !== "access") {
    return unauthorized(res, "Invalid token");
  }

  req.auth = {
    userId: String(payload.sub),
    jti: payload.jti,
    exp: payload.exp,
    position: parseSessionPosition(payload.position),
  };
  next();
}
