import { Router } from "express";
import {
  logout,
  memberForgotPassword,
  memberLogin,
  memberResetPassword,
  memberVerifyOtp,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

export const authRouter = Router();

authRouter.post("/member-login", memberLogin);
authRouter.post("/member-forgot-password", memberForgotPassword);
authRouter.post("/member-verify-otp", memberVerifyOtp);
authRouter.post("/member-reset-password", memberResetPassword);
authRouter.post("/logout", requireAuth, logout);
