import * as argon2 from "argon2";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

// PHP's password_verify expects the $2y$ prefix, so the $2b$ that bcryptjs writes is swapped for it
// (same algorithm, same hash) and the old app can still check passwords set here.
export async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return hash.replace(/^\$2[ab]\$/, "$2y$");
}

// Existing users have bcrypt hashes from the PHP app ($2y$...); argon2 hashes are accepted too.
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (hash.startsWith("$argon2")) {
    return argon2.verify(hash, password);
  }
  if (/^\$2[aby]\$/.test(hash)) {
    return bcrypt.compare(password, hash);
  }
  return false;
}
