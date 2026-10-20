import { Router } from "express";
import {
  approvePublicRegistration,
  childOrganisations,
  createPublicRegistration,
  createRegistration,
  listPublicRegistrations,
  listRegistrations,
  listRenewals,
  lookupMember,
  lookupSubscribers,
  publicChildren,
  publicContext,
  publicPrice,
  registrationAnalytics,
  registrationContext,
  registrationPrice,
  rejectPublicRegistration,
  subscriberDetails,
  updateSubscription,
} from "./pv.controller.js";
import { analysisPlaces, analysisSubscriptions, analysisSummary } from "./pv-analysis.controller.js";
import { saveTargets, targetsView } from "./pv-targets.controller.js";
import { publicFormRateLimit } from "../../middlewares/rate-limit.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import { requirePermission } from "../../middlewares/require-permission.js";
import { AppModule } from "../../constants/modules.js";

export const pvRouter = Router();

// Every route is for authenticated users; permissions are checked per action and module.
pvRouter.use(requireAuth);

pvRouter.get("/registration/context", requirePermission(AppModule.PV, "read"), registrationContext);
pvRouter.get("/registration/children", requirePermission(AppModule.PV, "read"), childOrganisations);
pvRouter.get("/registration/price", requirePermission(AppModule.PV, "read"), registrationPrice);
pvRouter.post("/registrations", requirePermission(AppModule.PV, "create"), createRegistration);
pvRouter.get("/registrations", requirePermission(AppModule.PV, "read"), listRegistrations);
pvRouter.get("/analytics", requirePermission(AppModule.PV, "read"), registrationAnalytics);
pvRouter.get("/targets", requirePermission(AppModule.PV, "read"), targetsView);
pvRouter.get("/analysis/summary", requirePermission(AppModule.PV, "read"), analysisSummary);
pvRouter.get("/analysis/subscriptions", requirePermission(AppModule.PV, "read"), analysisSubscriptions);
pvRouter.get("/analysis/places", requirePermission(AppModule.PV, "read"), analysisPlaces);
pvRouter.put("/targets", requirePermission(AppModule.PV, "update"), saveTargets);
pvRouter.get("/subscribers/lookup", requirePermission(AppModule.PV, "read"), lookupSubscribers);
pvRouter.get("/members/lookup", requirePermission(AppModule.PV, "read"), lookupMember);
pvRouter.get("/renewals", requirePermission(AppModule.PV, "read"), listRenewals);
pvRouter.get(
  "/public-registrations",
  requirePermission(AppModule.PV, "read"),
  listPublicRegistrations,
);
pvRouter.post(
  "/public-registrations/:subscriber_id/approve",
  requirePermission(AppModule.PV, "update"),
  approvePublicRegistration,
);
pvRouter.post(
  "/public-registrations/:subscriber_id/reject",
  requirePermission(AppModule.PV, "update"),
  rejectPublicRegistration,
);
pvRouter.get(
  "/subscribers/:subscriber_id",
  requirePermission(AppModule.PV, "read"),
  subscriberDetails,
);
pvRouter.put(
  "/subscribers/:subscriber_id/subscriptions/:year",
  requirePermission(AppModule.PV, "update"),
  updateSubscription,
);

// A leader's public registration link: no login. root_id is the leader's place the link was made for.
export const pvPublicRouter = Router();

pvPublicRouter.get("/links/:root_id", publicContext);
pvPublicRouter.get(
  "/links/:root_id/children",
  publicChildren,
);
pvPublicRouter.get("/links/:root_id/price", publicPrice);
pvPublicRouter.post(
  "/registrations",
  publicFormRateLimit,
  createPublicRegistration,
);

