import { Router } from "express";
import {
  logout,
  memberChangePassword,
  memberLogin,
  memberPositions,
  selectPosition,
} from "./auth.controller.js";
import {
  changePasswordBody,
  loginBody,
  selectPositionBody,
} from "./auth.schema.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import { authRateLimit } from "../../middlewares/rate-limit.js";
import { validate } from "../../middlewares/validate.js";

export const authRouter = Router();

// Every request to login is a guess at a credential, so it gets the tight limiter. The
// authenticated routes below are already gated by a valid token.
authRouter.post("/member-login", authRateLimit, validate({ body: loginBody }), memberLogin);

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
