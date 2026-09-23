// JWTs can't be withdrawn once issued, so logout records the token's id (jti) until the token
// would expire anyway. This list lives in memory: it is lost on restart and is not shared between
// processes, so a revoked token works again after a restart. Move it to Redis or a table if that matters.
const revokedUntil = new Map<string, number>();

const nowInSeconds = () => Math.floor(Date.now() / 1000);

export function revokeToken(jti: string, exp: number): void {
  const now = nowInSeconds();
  for (const [id, expiresAt] of revokedUntil) {
    if (expiresAt <= now) revokedUntil.delete(id);
  }
  if (exp > now) revokedUntil.set(jti, exp);
}

export function isTokenRevoked(jti: string): boolean {
  const expiresAt = revokedUntil.get(jti);
  if (expiresAt === undefined) return false;
  if (expiresAt <= nowInSeconds()) {
    revokedUntil.delete(jti);
    return false;
  }
  return true;
}

