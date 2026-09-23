import type { Request, Response } from "express";
import * as memberService from "./member.service.js";
import { handleError, sendError, sendSuccess } from "../../utils/response.js";

export const memberProfile = async (req: Request, res: Response) => {
  try {
    // requireAuth has verified the session token; sub is users.id.
    const userId = Number(req.auth?.userId);
    if (!Number.isInteger(userId)) {
      return sendError(res, 401, "Invalid token");
    }

    const profile = await memberService.getProfile(userId);

    return sendSuccess(res, "Profile fetched successfully", { profile });
  } catch (error) {
    return handleError(res, error, "Member profile error:");
  }
};
