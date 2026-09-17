import { randomInt } from "node:crypto";

// Six-digit code, zero-padded so it always has six characters.
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// The PHP app keeps OTPs in a membership_otp table keyed by mem_id, but that table does not exist
// in this database, so codes are kept in memory instead: one per member, lost on restart and not
// shared between processes. Move this to a table or Redis before running more than one instance.
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type StoredOtp = { otp: string; expiresAt: number; attempts: number };

const codes = new Map<number, StoredOtp>();

export function saveOtp(memberId: number, otp: string): void {
  const now = Date.now();
  for (const [id, entry] of codes) {
    if (entry.expiresAt <= now) codes.delete(id);
  }
  codes.set(memberId, { otp, expiresAt: now + OTP_TTL_MS, attempts: 0 });
}

export type OtpCheck = "ok" | "missing" | "wrong" | "too_many_attempts";

// Six digits are quick to guess, so a code gets a few tries and is thrown away once used or spent.
export function checkOtp(memberId: number, otp: string): OtpCheck {
  const entry = codes.get(memberId);

  if (!entry || entry.expiresAt <= Date.now()) {
    codes.delete(memberId);
    return "missing";
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    codes.delete(memberId);
    return "too_many_attempts";
  }

  entry.attempts += 1;

  if (entry.otp !== otp) {
    return "wrong";
  }

  codes.delete(memberId);
  return "ok";
}

export function clearOtp(memberId: number): void {
  codes.delete(memberId);
}
