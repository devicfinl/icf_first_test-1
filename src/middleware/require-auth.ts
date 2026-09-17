import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { isTokenRevoked } from "../lib/token-denylist.js";

const jwtSecret = process.env.JWT_SECRET ?? "";
if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set");
}

function unauthorized(res: Response, message: string) {
  return res.status(401).json({ success: false, message, data: null });
}

// Rejects requests without a valid, unrevoked Bearer token; put it before any protected route.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const [scheme, token] = (req.get("authorization") ?? "").split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") {
    return unauthorized(res, "Token not provided");
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, jwtSecret) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return unauthorized(res, "Token already expired");
    }
    return unauthorized(res, "Invalid token");
  }

  if (!payload.jti || !payload.exp || isTokenRevoked(payload.jti)) {
    return unauthorized(res, "Token is no longer valid");
  }

  // Password-reset tokens are signed with the same secret but must not open protected routes.
  if (payload.purpose !== "access") {
    return unauthorized(res, "Invalid token");
  }

  req.auth = { userId: String(payload.sub), jti: payload.jti, exp: payload.exp };
  next();
}
