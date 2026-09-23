import { Router } from "express";
import { memberProfile } from "./member.controller.js";
import { requireAuth } from "../../middlewares/require-auth.js";

export const memberRouter = Router();

memberRouter.get("/profile", requireAuth, memberProfile);
