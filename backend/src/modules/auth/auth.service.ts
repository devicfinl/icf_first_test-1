import * as authRepository from "./auth.repository.js";
import { AppError } from "../../utils/app-error.js";
import { createAttemptLimiter } from "../../utils/attempt-limiter.js";
import {
  type SessionPosition,
  signAccessToken,
} from "../../utils/jwt.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { revokeToken } from "../../utils/token-denylist.js";
import { resolveOrganisationSummaries } from "./reference-data.service.js";

// Membership numbers are 2 letters followed by 7 digits (e.g. "OM2400110"). Checked again here
// (mirrors auth.schema.ts) since the service is also called directly from tests, without going
// through the validate middleware.
const USERNAME_PATTERN = /^[A-Za-z]{2}\d{7}$/;

// Login reports which of the two fields was wrong: an unrecognised or malformed username gets
// USERNAME_ERROR, a recognised username with the wrong password gets PASSWORD_ERROR. (This is a
// deliberate product choice — it does mean an attacker can use it to test which membership
// numbers have accounts. The per-account lockout below is what limits that.)
const USERNAME_ERROR = "Username is wrong";
const PASSWORD_ERROR = "Password is wrong";

// Per-account throttle on login. IP rate limiting sits in front of this (see
// middlewares/rate-limit.ts); this is what stops an attacker who rotates IPs from working through
// one account's passwords.
const loginLimiter = createAttemptLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 });

// Exposed so tests can start from a clean slate; nothing in the app calls this.
export const __testing = { loginLimiter };

// Request values arrive untrusted from req.body. The validate middleware checks them before a
// controller runs, but these guards stay as the service's own contract: it is also called directly
// from tests, and a service should not depend on a caller having run the right middleware.
interface LoginInput {
  userName?: unknown;
  password?: unknown;
}

interface SelectPositionInput {
  auth: { userId: string; jti: string; exp: number };
  positionId?: unknown;
}

interface ChangePasswordInput {
  auth: { userId: string; jti: string; exp: number; position: SessionPosition | null };
  currentPassword?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
}

// One committee position a member may act as, with the display values the selection screen needs.
export interface MemberPosition {
  id: number;
  designation: { id: number; name: string; level: number };
  organisation: { id: number; name: string | null; level: string | null };
}

interface LoginResult {
  token: string;
  name: string;
  position: MemberPosition | null;
  positions: MemberPosition[];
  requiresPositionSelection: boolean;
}

function toSessionPosition(position: MemberPosition): SessionPosition {
  return { cmid: position.id, desid: position.designation.id, orgid: position.organisation.id };
}

// The cabinet positions a member may sign in as. users.member_no is the membership number, whose
// membership_master.mid is what committee_members.cmem_id points at. A member with no committee
// row, or whose designations are all non-cabinet, simply gets an empty list.
async function cabinetPositions(memberNo: string): Promise<MemberPosition[]> {
  if (!memberNo) return [];

  const member = await authRepository.findMembershipByMembershipNo(memberNo);

  if (!member) return [];

  const committeeMember = await authRepository.findCommitteeMembershipsByMemberMid(member.mid);
 
  if (committeeMember.length === 0) return [];

  const [designations, organisations] = await Promise.all([
    authRepository.findCabinetDesignations(committeeMember.map((committeeMember) => committeeMember.cdesignId)),
    resolveOrganisationSummaries(committeeMember.map((committeeMember) => committeeMember.corgId)),
  ]);



  const cabinet = new Map(designations.map((designation) => [designation.desid, designation] as const));


  return committeeMember.flatMap((membership) => {
    const designation = cabinet.get(membership.cdesignId);  

    // Dropped on purpose: the member holds this position but it isn't a cabinet one.
    if (!designation) return [];

    const organisation = organisations.get(membership.corgId) ?? { id: membership.corgId, name: null, level: null };

    return [
      {
        id: membership.cmid,
        designation: { id: designation.desid, name: designation.desigName, level: designation.desigLevel },
        organisation,
      },
    ];
  });
}

// Returns a session token (see signAccessToken) plus the committee positions the member may act as.
export async function login({ userName, password }: LoginInput): Promise<LoginResult> {
  if (typeof userName !== "string" || userName.trim() === "" || !USERNAME_PATTERN.test(userName.trim())) {
    throw AppError.badRequest(USERNAME_ERROR);
  }

  if (typeof password !== "string" || password === "") {
    throw AppError.badRequest("Please enter your password.");
  }

  const identifier = userName.trim();
  // Case-insensitive so an attacker can't get a fresh allowance per capitalisation of the same name.
  const limiterKey = identifier.toLowerCase();

  if (loginLimiter.isLockedOut(limiterKey)) {
    throw AppError.tooManyRequests("Too many sign-in attempts. Please try again in a few minutes.");
  }

  const user = await authRepository.findUserByUserName(identifier);

  // An unknown username still counts as a failure against the limiter, so guessing names costs the
  // same as guessing passwords.
  if (!user) {
    loginLimiter.recordFailure(limiterKey);
    throw AppError.unauthorized(USERNAME_ERROR);
  }

  if (!user.password || !(await verifyPassword(user.password, password))) {
    loginLimiter.recordFailure(limiterKey);
    throw AppError.unauthorized(PASSWORD_ERROR);
  }

  // users.active: 1 = enabled. Checked after the password so a wrong password on a disabled
  // account doesn't reveal that the account exists.
  if (user.active !== 1) {
    throw AppError.unauthorized("Your login is disabled");
  }

  loginLimiter.clear(limiterKey);

  const positions = await cabinetPositions(user.memberNo);

  // A single position is the member's context right away; several have to be chosen (selectPosition)
  // before the session carries one, and none means they sign in without a committee context at all.
  const position = positions.length === 1 ? positions[0]! : null;

  return {
    token: signAccessToken(user.id, user.userName, position && toSessionPosition(position)),
    name: user.name,
    position,
    positions,
    requiresPositionSelection: positions.length > 1,
  };
}

// The positions the caller may switch to, for the selection screen after login and later on.
export async function listPositions(userId: string): Promise<MemberPosition[]> {
  const user = await requireActiveUser(userId);

  return cabinetPositions(user.memberNo);
}

// Swaps the caller's session token for one carrying the chosen committee context. The old token is
// revoked, so the previous context can't keep being used alongside the new one.
export async function selectPosition({ auth, positionId }: SelectPositionInput) {
  const id = Number(positionId);

  if (!Number.isInteger(id) || id <= 0) {
    throw AppError.badRequest("Please choose one of your committee positions.");
  }

  const user = await requireActiveUser(auth.userId);
  const position = (await cabinetPositions(user.memberNo)).find((candidate) => candidate.id === id);

  // Also covers a position that exists but belongs to another member: the caller is told the same
  // thing either way, so this can't be used to probe other members' committee rows.
  if (!position) {
    throw AppError.forbidden("That committee position is not available to you.");
  }

  const token = signAccessToken(user.id, user.userName, toSessionPosition(position));
  revokeToken(auth.jti, auth.exp);

  return { token, position };
}

// The account behind a verified session token. It is re-read on every use because a member can be
// disabled while holding a still-valid token.
async function requireActiveUser(userId: string) {
  const id = Number(userId);
  const user = Number.isInteger(id) ? await authRepository.findUserById(id) : null;

  if (!user) {
    throw AppError.unauthorized("Member not found");
  }

  if (user.active !== 1) {
    throw AppError.unauthorized("Your login is disabled");
  }

  return user;
}

export function logout(auth: { jti: string; exp: number }): void {
  revokeToken(auth.jti, auth.exp);
}

// Changes the password of the signed-in member. Returns a replacement token: the old one is
// revoked, so a token captured before the change stops working, while the member stays signed in
// on the device they actually made the change from.
export async function changePassword({
  auth,
  currentPassword,
  newPassword,
  confirmPassword,
}: ChangePasswordInput): Promise<{ token: string }> {
  if (typeof currentPassword !== "string" || currentPassword === "") {
    throw AppError.badRequest("Please enter your current password.");
  }

  if (typeof newPassword !== "string" || typeof confirmPassword !== "string") {
    throw AppError.badRequest("Password and confirm password must be text.");
  }

  if (newPassword !== confirmPassword) {
    throw AppError.badRequest("Passwords do not match");
  }

  if (newPassword.length < 8) {
    throw AppError.badRequest("Password must be at least 8 characters.");
  }

  if (newPassword === currentPassword) {
    throw AppError.badRequest("Your new password must be different from your current one.");
  }

  const user = await requireActiveUser(auth.userId);

  if (!user.password || !(await verifyPassword(user.password, currentPassword))) {
    throw AppError.unauthorized("Your current password is not correct.");
  }

  await authRepository.updateUserPassword(user.id, await hashPassword(newPassword));

  // The new token keeps whatever committee context the session already had, so the member is not
  // sent back through position selection just because they changed their password.
  const token = signAccessToken(user.id, user.userName, auth.position);
  revokeToken(auth.jti, auth.exp);

  return { token };
}
