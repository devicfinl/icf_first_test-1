import { Router } from "express";
import {
  approvePublicRegistration,
  childOrganisations,
  createPublicRegistration,
  createRegistration,
  listPublicRegistrations,
  listRegistrations,
  listRenewals,
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
import { publicFormRateLimit } from "../../middlewares/rate-limit.js";
import { requireAuth } from "../../middlewares/require-auth.js";

export const pvRouter = Router();

// Every route is for leaders; the controller checks the leader's position on each request.
pvRouter.get("/registration/context", requireAuth, registrationContext);
pvRouter.get("/registration/children", requireAuth, childOrganisations);
pvRouter.get("/registration/price", requireAuth, registrationPrice);
pvRouter.post("/registrations", requireAuth, createRegistration);
pvRouter.get("/registrations", requireAuth, listRegistrations);
pvRouter.get("/analytics", requireAuth, registrationAnalytics);
pvRouter.get("/subscribers/lookup", requireAuth, lookupSubscribers);
pvRouter.get("/renewals", requireAuth, listRenewals);
pvRouter.get(
  "/public-registrations",
  requireAuth,
  listPublicRegistrations,
);
pvRouter.post(
  "/public-registrations/:subscriber_id/approve",
  requireAuth,
  approvePublicRegistration,
);
pvRouter.post(
  "/public-registrations/:subscriber_id/reject",
  requireAuth,
  rejectPublicRegistration,
);
pvRouter.get(
  "/subscribers/:subscriber_id",
  requireAuth,
  subscriberDetails,
);
pvRouter.put(
  "/subscribers/:subscriber_id/subscriptions/:year",
  requireAuth,
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

