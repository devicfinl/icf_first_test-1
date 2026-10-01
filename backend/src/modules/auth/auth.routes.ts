import { Router } from "express";
import {
  cancelAccountBody,
  changePasswordBody,
  loginBody,
  logout,
  me,
  memberCancelAccount,
  memberChangePassword,
  memberLogin,
  memberPositions,
  selectPosition,
  selectPositionBody,
} from "./auth.controller.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import { authRateLimit } from "../../middlewares/rate-limit.js";
import { validate } from "../../middlewares/validate.js";

export const authRouter = Router();

// Every request to login is a guess at a credential, so it gets the tight limiter. The
// authenticated routes below are already gated by a valid token.
authRouter.post("/member-login", authRateLimit, validate({ body: loginBody }), memberLogin);

// Verifies the caller's token and returns the session behind it; the app calls this once on load.
authRouter.get("/me", requireAuth, me);

// The committee positions the member may act as, and the choice of one for this session. Selecting
// replaces the caller's token with one carrying that context, so the old token stops working.
authRouter.get("/positions", requireAuth, memberPositions);
authRouter.post("/select-position", requireAuth, validate({ body: selectPositionBody }), selectPosition);
authRouter.post(
  "/change-password",
  requireAuth,
  validate({ body: changePasswordBody }),
  memberChangePassword,
);
authRouter.post("/logout", requireAuth, logout);

// Turns off sign-in for the account; no data is deleted. The tight limiter, because each request is
// a guess at the current password.
authRouter.post(
  "/cancel-account",
  authRateLimit,
  requireAuth,
  validate({ body: cancelAccountBody }),
  memberCancelAccount,
);
