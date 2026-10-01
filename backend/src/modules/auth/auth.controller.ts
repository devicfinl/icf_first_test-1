import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/index.js";
import { AppError } from "../../utils/app-error.js";
import { createAttemptLimiter } from "../../utils/attempt-limiter.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type SessionPosition,
  signAccessToken,
} from "../../utils/jwt.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { resolveOrganisationSummaries } from "../../utils/reference-data.js";
import { handleError, sendError, sendSuccess } from "../../utils/response.js";
import { revokeToken } from "../../utils/token-denylist.js";

/* ------------------------------------------------------------------ request schemas */

// z.strictObject rejects unknown fields. Messages are shown to the member on a 400.
const text = (message: string) => z.string({ error: message });

// 2 letters + 7 digits. Checked before any lookup, so a bad format never reveals whether an account exists.
const USERNAME_PATTERN = /^[A-Z]{2}\d{7}$/;

export const loginBody = z.strictObject({
  userName: text("Username is wrong")
    .trim()
    .min(1, "Username is wrong")
    .regex(USERNAME_PATTERN, "Username is wrong"),
  password: text("Please enter your password.").min(1, "Please enter your password."),
});

export const selectPositionBody = z.strictObject({
  positionId: z.coerce
    .number({ error: "Please choose one of your committee positions." })
    .int("Please choose one of your committee positions.")
    .positive("Please choose one of your committee positions."),
});

const newPassword = text("Please enter a new password.")
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password is too long.");

// The current password is required so a stolen token can't take the account over.
export const changePasswordBody = z
  .strictObject({
    currentPassword: text("Please enter your current password.").min(1, "Please enter your current password."),
    newPassword,
    confirmPassword: text("Please confirm your new password.").min(1, "Please confirm your new password."),
  })
  .refine((body) => body.newPassword === body.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((body) => body.newPassword !== body.currentPassword, {
    message: "Your new password must be different from your current one.",
    path: ["newPassword"],
  });

// Cancelling an account: the password proves it's the member, and `confirm` that they meant it.
export const cancelAccountBody = z.strictObject({
  currentPassword: text("Please enter your current password.").min(1, "Please enter your current password."),
  confirm: z.literal(true, { error: "Please confirm that you want to cancel your account." }),
});

export type LoginBody = z.infer<typeof loginBody>;
export type SelectPositionBody = z.infer<typeof selectPositionBody>;
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;
export type CancelAccountBody = z.infer<typeof cancelAccountBody>;

/* ------------------------------------------------------------------ handlers */

// req.body is already validated against the schemas above (see auth.routes.ts).

// Separate messages are a product choice; they reveal which usernames exist, which the lockout limits.
const USERNAME_ERROR = "Username is wrong";
const PASSWORD_ERROR = "Password is wrong";

// Per-account lockout, on top of per-IP rate limiting, so rotating IPs doesn't help an attacker.
const loginLimiter = createAttemptLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 });

// For tests only.
export const __testing = { loginLimiter };

// Never select the whole users row.
const SESSION_USER_COLUMNS = {
  id: true,
  userName: true,
  memberNo: true,
  name: true,
  password: true,
  active: true,
} as const;

export interface MemberPosition {
  id: number;
  designation: { id: number; name: string; level: number };
  organisation: { id: number; name: string | null; level: string | null };
}

function toSessionPosition(position: MemberPosition): SessionPosition {
  return { cmid: position.id, desid: position.designation.id, orgid: position.organisation.id };
}

function tokenPayload(token: string) {
  return { token, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_SECONDS };
}

// Cabinet positions the member may act as: users.member_no -> membership_master.mid -> committee_members.cmem_id.
async function cabinetPositions(memberNo: string): Promise<MemberPosition[]> {
  if (!memberNo) return [];

  const member = await prisma.membershipMaster.findFirst({ where: { membershipNo: memberNo } });

  if (!member) return [];

  const committeeMember = await prisma.committeeMember.findMany({
    where: { cmemId: member.mid },
    select: { cmid: true, cdesignId: true, corgId: true },
    orderBy: { cmid: "asc" },
  });

  if (committeeMember.length === 0) return [];

  const [designations, organisations] = await Promise.all([
    // Only cabinet designations can be a session context.
    prisma.committeeDesignations.findMany({
      where: { desid: { in: committeeMember.map((committeeMember) => committeeMember.cdesignId) }, isCabinet: "Y" },
      select: { desid: true, desigName: true, desigLevel: true },
    }),
    resolveOrganisationSummaries(committeeMember.map((committeeMember) => committeeMember.corgId)),
  ]);

  const cabinet = new Map(designations.map((designation) => [designation.desid, designation] as const));

  return committeeMember.flatMap((membership) => {
    const designation = cabinet.get(membership.cdesignId);

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

// Re-read on every use: a member can be disabled while holding a still-valid token.
async function requireActiveUser(userId: string) {
  const id = Number(userId);
  const user = Number.isInteger(id)
    ? await prisma.user.findUnique({ where: { id }, select: SESSION_USER_COLUMNS })
    : null;

  if (!user) {
    throw AppError.unauthorized("Member not found");
  }

  if (user.active !== 1) {
    throw AppError.unauthorized("Your login is disabled");
  }

  return user;
}

export const memberLogin = async (req: Request, res: Response) => {
  try {
    const { userName, password } = (req.body ?? {}) as LoginBody;

    const identifier = userName.trim();
    // Lowercased so changing capitalisation doesn't reset the lockout.
    const limiterKey = identifier.toLowerCase();

    if (loginLimiter.isLockedOut(limiterKey)) {
      throw AppError.tooManyRequests("Too many sign-in attempts. Please try again in a few minutes.");
    }

    const user = await prisma.user.findFirst({ where: { userName: identifier }, select: SESSION_USER_COLUMNS });

    if (!user) {
      loginLimiter.recordFailure(limiterKey);
      throw AppError.unauthorized(USERNAME_ERROR);
    }

    if (!user.password || !(await verifyPassword(user.password, password))) {
      loginLimiter.recordFailure(limiterKey);
      throw AppError.unauthorized(PASSWORD_ERROR);
    }

    // Checked after the password so a disabled account isn't revealed by a wrong password.
    if (user.active !== 1) {
      throw AppError.unauthorized("Your login is disabled");
    }

    loginLimiter.clear(limiterKey);

    const positions = await cabinetPositions(user.memberNo);

    // One position is applied now; several must be chosen via select-position.
    const position = positions.length === 1 ? positions[0]! : null;
    const requiresPositionSelection = positions.length > 1;

    const message = requiresPositionSelection
      ? "Login successful. Please select the committee position to continue with."
      : "Login successful";

    return sendSuccess(res, message, {
      auth: tokenPayload(signAccessToken(user.id, user.userName, position && toSessionPosition(position))),
      name: user.name,
      position,
      positions,
      requires_position_selection: requiresPositionSelection,
    });
  } catch (error) {
    return handleError(res, error, "Member login error:");
  }
};

export const memberPositions = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return sendError(res, 401, "Token not provided");
    }

    const user = await requireActiveUser(req.auth.userId);
    const positions = await cabinetPositions(user.memberNo);

    return sendSuccess(res, "Positions fetched successfully", { positions });
  } catch (error) {
    return handleError(res, error, "Member positions error:");
  }
};

// Restores the session on page load.
export const me = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return sendError(res, 401, "Token not provided");
    }

    const auth = req.auth;
    const user = await requireActiveUser(auth.userId);
    const positions = await cabinetPositions(user.memberNo);

    // Checked against the live list, not trusted from the token.
    const position = (auth.position && positions.find((candidate) => candidate.id === auth.position!.cmid)) ?? null;

    return sendSuccess(res, "Session is valid", {
      membership_no: user.userName,
      name: user.name,
      position,
      positions,
      requires_position_selection: !position && positions.length > 1,
      expires_at: auth.exp,
    });
  } catch (error) {
    return handleError(res, error, "Current session error:");
  }
};

// Issues a token carrying the chosen position and revokes the old one.
export const selectPosition = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return sendError(res, 401, "Token not provided");
    }

    const { positionId } = (req.body ?? {}) as SelectPositionBody;

    const user = await requireActiveUser(req.auth.userId);
    const position = (await cabinetPositions(user.memberNo)).find((candidate) => candidate.id === positionId);

    // Same answer for another member's position, so it can't be used to probe.
    if (!position) {
      throw AppError.forbidden("That committee position is not available to you.");
    }

    const token = signAccessToken(user.id, user.userName, toSessionPosition(position));
    revokeToken(req.auth.jti, req.auth.exp);

    return sendSuccess(res, "Committee position selected successfully", {
      auth: tokenPayload(token),
      position,
    });
  } catch (error) {
    return handleError(res, error, "Select position error:");
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return sendError(res, 401, "Token not provided");
    }

    revokeToken(req.auth.jti, req.auth.exp);

    return sendSuccess(res, "Successfully logged out");
  } catch (error) {
    return handleError(res, error, "Logout error:", "Failed to logout");
  }
};

// Returns a replacement token and revokes the old one.
export const memberChangePassword = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return sendError(res, 401, "Token not provided");
    }

    const { currentPassword, newPassword } = (req.body ?? {}) as ChangePasswordBody;

    const user = await requireActiveUser(req.auth.userId);

    if (!user.password || !(await verifyPassword(user.password, currentPassword))) {
      throw AppError.unauthorized("Your current password is not correct.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword) },
      select: { id: true },
    });

    // Keeps the session's committee position.
    const token = signAccessToken(user.id, user.userName, req.auth.position);
    revokeToken(req.auth.jti, req.auth.exp);

    return sendSuccess(res, "Password updated successfully", { auth: tokenPayload(token) });
  } catch (error) {
    return handleError(res, error, "Member change password error:");
  }
};

// Cancels the member's portal account: sign-in is switched off (users.active = 0) and this session's
// token is revoked. Nothing is deleted - the membership record, donations and subscription history
// stay with the organisation, and the office can restore access.
export const memberCancelAccount = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return sendError(res, 401, "Token not provided");
    }

    const { currentPassword } = (req.body ?? {}) as CancelAccountBody;

    const user = await requireActiveUser(req.auth.userId);

    if (!user.password || !(await verifyPassword(user.password, currentPassword))) {
      throw AppError.unauthorized("Your current password is not correct.");
    }

    await prisma.user.update({ where: { id: user.id }, data: { active: 0 }, select: { id: true } });
    revokeToken(req.auth.jti, req.auth.exp);

    return sendSuccess(res, "Your account has been cancelled");
  } catch (error) {
    return handleError(res, error, "Member cancel account error:");
  }
};
