import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import type {
  ChangePasswordBody,
  LoginBody,
  SelectPositionBody,
} from "./auth.schema.js";
import { ACCESS_TOKEN_TTL_SECONDS } from "../../utils/jwt.js";
import { handleError, sendError, sendSuccess } from "../../utils/response.js";

// req.body has been through the schemas in auth.schema.ts by the time these run (see the routes),
// so the casts below describe what the validate middleware guarantees.

export const memberLogin = async (req: Request, res: Response) => {
  try {
    const { userName, password } = (req.body ?? {}) as LoginBody;

    const { token, position, positions, requiresPositionSelection } = await authService.login({
      userName,
      password,
    });

    const message = requiresPositionSelection
      ? "Login successful. Please select the committee position to continue with."
      : "Login successful";

    return sendSuccess(res, message, {
      auth: {
        token,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
      },
      // The token already carries `position` when there is exactly one; with several, the member
      // picks from `positions` and calls select-position for a token that carries their choice.
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

    const positions = await authService.listPositions(req.auth.userId);

    return sendSuccess(res, "Positions fetched successfully", { positions });
  } catch (error) {
    return handleError(res, error, "Member positions error:");
  }
};

export const selectPosition = async (req: Request, res: Response) => {
  try {
    // requireAuth verifies the token and sets req.auth before this runs.
    if (!req.auth) {
      return sendError(res, 401, "Token not provided");
    }

    const { positionId } = (req.body ?? {}) as SelectPositionBody;

    const { token, position } = await authService.selectPosition({ auth: req.auth, positionId });

    return sendSuccess(res, "Committee position selected successfully", {
      auth: {
        token,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
      },
      position,
    });
  } catch (error) {
    return handleError(res, error, "Select position error:");
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    // requireAuth verifies the token and sets req.auth before this runs.
    if (!req.auth) {
      return sendError(res, 401, "Token not provided");
    }

    authService.logout(req.auth);

    return sendSuccess(res, "Successfully logged out");
  } catch (error) {
    return handleError(res, error, "Logout error:", "Failed to logout");
  }
};

export const memberChangePassword = async (req: Request, res: Response) => {
  try {
    // requireAuth verifies the token and sets req.auth before this runs.
    if (!req.auth) {
      return sendError(res, 401, "Token not provided");
    }

    const { currentPassword, newPassword, confirmPassword } = (req.body ?? {}) as ChangePasswordBody;

    const { token } = await authService.changePassword({
      auth: req.auth,
      currentPassword,
      newPassword,
      confirmPassword,
    });

    // The caller's previous token was revoked, so they must switch to this one to stay signed in.
    return sendSuccess(res, "Password updated successfully", {
      auth: {
        token,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
      },
    });
  } catch (error) {
    return handleError(res, error, "Member change password error:");
  }
};
