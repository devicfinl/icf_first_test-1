import { Router } from "express";
import { requireAuth } from "../../middlewares/require-auth.js";
import {
  getMatrix,
  getMyPermissions,
  getOrganisations,
  getRoles,
  updatePermissions,
} from "./access-control.controller.js";

export const accessControlRouter = Router();

// Current user's effective permissions based on active committee role
accessControlRouter.get("/my-permissions", requireAuth, getMyPermissions);

// Super User administrative endpoints
accessControlRouter.get("/roles", requireAuth({ systemAdminOnly: true }), getRoles);
accessControlRouter.get("/organisations", requireAuth({ systemAdminOnly: true }), getOrganisations);
accessControlRouter.get("/matrix", requireAuth({ systemAdminOnly: true }), getMatrix);
accessControlRouter.post("/permissions", requireAuth({ systemAdminOnly: true }), updatePermissions);
