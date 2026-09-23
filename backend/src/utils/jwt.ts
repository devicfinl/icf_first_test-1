import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

export const ACCESS_TOKEN_TTL_SECONDS = env.accessTokenTtlSeconds;

// The committee position a member is acting as for this session: committee_members.cmid and the
// two ids it points at (committee_designations.desid, organisation_master.orgid). Only ids travel
// in the token — names are display values and would bloat every request.
export interface SessionPosition {
  cmid: number;
  desid: number;
  orgid: number;
}

// A token issued before the member picked a position (or for a member with none) has no position
// claim at all, so anything unrecognised here is treated as "no context chosen".
export function parseSessionPosition(value: unknown): SessionPosition | null {
  if (!value || typeof value !== "object") return null;

  const { cmid, desid, orgid } = value as Record<string, unknown>;
  if (!Number.isInteger(cmid) || !Number.isInteger(desid) || !Number.isInteger(orgid)) return null;

  return { cmid: cmid as number, desid: desid as number, orgid: orgid as number };
}

export function signAccessToken(userId: number, userName: string, position: SessionPosition | null = null): string {
  return jwt.sign(
    {
      sub: String(userId),
      userName,
      // Marks this as a session token; requireAuth refuses tokens issued for anything else.
      purpose: "access",
      ...(position ? { position } : {}),
    },
    env.jwtSecret,
    {
      expiresIn: env.accessTokenTtlSeconds,
      // Token id, so logout can revoke this exact token (see token-denylist).
      jwtid: randomUUID(),
    },
  );
}

// Throws if the token is malformed, tampered with or expired (see isTokenExpiredError).
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

export function isTokenExpiredError(error: unknown): boolean {
  return error instanceof jwt.TokenExpiredError;
}
