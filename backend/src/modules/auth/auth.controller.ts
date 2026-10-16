import type { NextFunction, Request, Response } from "express";
import { body } from "express-validator";
import { z } from "zod";
import { prisma } from "../../db/index.js";
import { AppError } from "../../utils/app-error.js";
import { AppResponse } from "../../utils/app-response.js";
import { createAttemptLimiter } from "../../utils/attempt-limiter.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type SessionPosition,
  signAccessToken,
} from "../../utils/jwt.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { resolveOrganisationSummaries } from "../../utils/reference-data.js";
import { resolveUserRoles } from "../../utils/rbac.js";
import { revokeToken } from "../../utils/token-denylist.js";
import { sendError } from "../../utils/response.js";
import { validate } from "../../utils/validate.js";

// 2 letters + 7 digits. Checked before any lookup, so a bad format never reveals whether an account exists.
const USERNAME_PATTERN = /^[A-Z]{2}\d{7}$/;

// Cancelling an account: the password proves it's the member, and `confirm` that they meant it.
export const cancelAccountBody = z.strictObject({
  currentPassword: z.string({ error: "Please enter your current password." }).min(1, "Please enter your current password."),
  confirm: z.literal(true, { error: "Please confirm that you want to cancel your account." }),
});

export type CancelAccountBody = z.infer<typeof cancelAccountBody>;

/* ------------------------------------------------------------------ handlers */



// Per-account lockout, on top of per-IP rate limiting, so rotating IPs doesn't help an attacker.
const loginLimiter = createAttemptLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 });


// Never select the whole users row.
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
    ? await prisma.user.findUnique({
      where: { id }, select: {
        id: true,
        userName: true,
        memberNo: true,
        name: true,
        password: true,
        active: true,
        role: true,
        isOfficeUser: true,
      }
    })
    : null;

  if (!user) {
    throw new AppError("Member not found", 404);
  }

  if (user.active !== 1) {
    throw new AppError("Your login is disabled", 401);
  }

  return user;
}

export const memberLogin = async (req: Request, res: Response, next: NextFunction) => {
  await body("userName").trim().notEmpty().withMessage("Username is wrong").matches(USERNAME_PATTERN).withMessage("Username is wrong").run(req);
  await body("password").notEmpty().withMessage("Please enter your password.").run(req);

  if (!validate(req, res)) return;

  const { userName, password } = req.body;

  // Lowercased so changing capitalisation doesn't reset the lockout.
  const limiterKey = userName.toLowerCase();

  if (loginLimiter.isLockedOut(limiterKey)) {
    throw new AppError("Too many sign-in attempts. Please try again in a few minutes.", 429);
  }

  const user = await prisma.user.findFirst({
    where: { userName: userName },
    select: {
      id: true,
      userName: true,
      memberNo: true,
      name: true,
      password: true,
      active: true,
      role: true,
      isOfficeUser: true,
    },
  });

  if (!user) {
    loginLimiter.recordFailure(limiterKey);
    throw new AppError("Invalid Credentials", 401);
  }

  if (!user.password || !(await verifyPassword(user.password, password))) {
    loginLimiter.recordFailure(limiterKey);
    throw new AppError("Invalid Credentials", 401);
  }

  // Checked after the password so a disabled account isn't revealed by a wrong password.
  if (user.active !== 1) {
    throw new AppError("Your login is disabled", 401);
  }

  loginLimiter.clear(limiterKey);

  const positions = await cabinetPositions(user.memberNo);

  // Only members holding a cabinet committee position (committee_designations.is_cabinet = 'Y')
  // may sign in. Checked after the password, so it reveals nothing to someone guessing.
  if (positions.length === 0) {
    throw new AppError("Only members holding a cabinet committee position can sign in.", 403);
  }

  // One position is applied now; several must be chosen via select-position.
  const position = positions.length === 1 ? positions[0]! : null;


  // Resolve all available roles for this user and inject them directly
  const roles = resolveUserRoles(user, positions);
  const activeRole = position ? position.designation.name : undefined;

  // const message = requiresPositionSelection
  //   ? "Login successful. Please select the committee position to continue with."
  //   : "Login successful";

  return next(
    new AppResponse("Login Successfull", {
      auth: tokenPayload(
        signAccessToken(
          user.id,
          user.userName,
          position && toSessionPosition(position),
          roles,
          activeRole,
        ),
      ),
      name: user.name,
      roles,
      role: activeRole ?? null,
      position,
      positions,
    }),
  );
};

export const memberPositions = async (req: Request, res: Response, next: NextFunction) => {
  const user = await requireActiveUser(req.user!.userId);
  const positions = await cabinetPositions(user.memberNo);

  return next(new AppResponse("Positions fetched successfully", { positions }));
};

// Restores the session on page load.
export const me = async (req: Request, res: Response, next: NextFunction) => {
  const authUser = req.user!;
  const user = await requireActiveUser(authUser.userId);
  const positions = await cabinetPositions(user.memberNo);

  // Checked against the live list, not trusted from the token.
  const position = (authUser.position && positions.find((candidate) => candidate.id === authUser.position!.cmid)) ?? null;
  const roles = resolveUserRoles(user, positions);
  const activeRole = position?.designation.name ?? (authUser.role ?? null);

  return next(
    new AppResponse("Session is valid", {
      membership_no: user.userName,
      name: user.name,
      roles,
      role: activeRole,
      position,
      positions,
      expires_at: authUser.exp,
    }),
  );
};

// Issues a token carrying the chosen position and revokes the old one.
export const selectPosition = async (req: Request, res: Response, next: NextFunction) => {
  await body("positionId").isInt({ min: 1 }).withMessage("Please choose one of your committee positions.").run(req);
  if (!validate(req, res)) return;

  const { positionId } = req.body;

  const user = await requireActiveUser(req.user!.userId);
  const positions = await cabinetPositions(user.memberNo);
  const position = positions.find((pos) => pos.id === positionId);

  // Same answer for another member's position, so it can't be used to probe.
  if (!position) {
    throw new AppError("That committee position is not available to you.", 403);
  }

  const roles = resolveUserRoles(user, positions);
  const activeRole = position.designation.name;

  const token = signAccessToken(
    user.id,
    user.userName,
    toSessionPosition(position),
    roles,
    activeRole,
  );
  revokeToken(req.user!.jti, req.user!.exp);

  return next(
    new AppResponse("Committee position selected successfully", {
      auth: tokenPayload(token),
      roles,
      role: activeRole,
      position,
    }),
  );
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  revokeToken(req.user!.jti, req.user!.exp);

  return next(new AppResponse("Successfully logged out"));
};

// Returns a replacement token and revokes the old one.
export const memberChangePassword = async (req: Request, res: Response, next: NextFunction) => {
  await body("currentPassword").notEmpty().withMessage("Please enter your current password.").run(req);
  await body("newPassword")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters.")
    .isLength({ max: 200 }).withMessage("Password is too long.")
    .custom((value, { req }) => value !== req.body?.currentPassword).withMessage("Your new password must be different from your current one.")
    .run(req);
  await body("confirmPassword")
    .custom((value, { req }) => value === req.body?.newPassword).withMessage("Passwords do not match")
    .run(req);

  if (!validate(req, res)) return;

  const { currentPassword, newPassword } = req.body;

  const user = await requireActiveUser(req.user!.userId);
  const verified = user.password && await verifyPassword(user.password, currentPassword);
  if (!verified) {
    throw new AppError("Your current password is not correct.", 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(newPassword) },
    select: { id: true },
  });

  // Keeps the session's committee position and roles.
  const token = signAccessToken(
    user.id,
    user.userName,
    req.user!.position,
    req.user!.roles,
    req.user!.role,
  );
  revokeToken(req.user!.jti, req.user!.exp);

  return next(new AppResponse("Password updated successfully", { auth: tokenPayload(token) }));
};

// Cancels the member's portal account: sign-in is switched off (users.active = 0) and this session's
// token is revoked. Nothing is deleted - the membership record, donations and subscription history
// stay with the organisation, and the office can restore access.
export const memberCancelAccount = async (req: Request, res: Response, next?: NextFunction) => {
  try {
    await body("currentPassword").notEmpty().withMessage("Please enter your current password.").run(req);
    await body("confirm")
      .custom((value) => value === true)
      .withMessage("Please confirm that you want to cancel your account.")
      .run(req);

    if (!validate(req, res)) return;

    const { currentPassword } = (req.body ?? {}) as CancelAccountBody;

    const authUser = req.user ?? req.auth;
    if (!authUser) {
      throw new AppError("Token not provided", 401);
    }

    const user = await requireActiveUser(authUser.userId);

    if (!user.password || !(await verifyPassword(user.password, currentPassword))) {
      throw new AppError("Your current password is not correct.", 401);
    }

    await prisma.user.update({ where: { id: user.id }, data: { active: 0 }, select: { id: true } });
    revokeToken(authUser.jti, authUser.exp);

    if (next) {
      return next(new AppResponse("Your account has been cancelled"));
    }
    return res.status(200).json(new AppResponse("Your account has been cancelled").toJSON());
  } catch (error) {
    if (next) {
      return next(error);
    }
    if (error instanceof AppError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    return sendError(res, 500, "Member cancel account error:");
  }
};
