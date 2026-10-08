import { Router } from "express";
import {
  logout,
  me,
  memberChangePassword,
  memberLogin,
  memberPositions,
  selectPosition,
} from "./auth.controller.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import { authRateLimit } from "../../middlewares/rate-limit.js";

export const authRouter = Router();

// Every request to login is a guess at a credential, so it gets the tight limiter. The
// authenticated routes below are already gated by a valid token.
authRouter.post("/member-login", authRateLimit, memberLogin);

// Verifies the caller's token and returns the session behind it; the app calls this once on load.
authRouter.get("/me", requireAuth, me);

// The committee positions the member may act as, and the choice of one for this session. Selecting
// replaces the caller's token with one carrying that context, so the old token stops working.
authRouter.get("/positions", requireAuth, memberPositions);
authRouter.post("/select-position", requireAuth, selectPosition);
authRouter.post("/change-password", requireAuth, memberChangePassword);
authRouter.post("/logout", requireAuth, logout);

