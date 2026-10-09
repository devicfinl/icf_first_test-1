import { Router } from "express";
import {
  analyticsQuery,
  approvePublicRegistration,
  childOrganisations,
  childrenQuery,
  createPublicRegistration,
  createRegistration,
  listPublicRegistrations,
  listRegistrations,
  listRenewals,
  lookupQuery,
  lookupSubscribers,
  priceQuery,
  publicChildren,
  publicChildrenQuery,
  publicContext,
  publicPrice,
  publicPriceQuery,
  publicRegistrationBody,
  publicRegistrationsQuery,
  publicRootParams,
  registrationAnalytics,
  registrationBody,
  registrationContext,
  registrationPrice,
  registrationsQuery,
  rejectBody,
  rejectPublicRegistration,
  renewalsQuery,
  subscriberDetails,
  subscriberParams,
  subscriberViewQuery,
  subscriptionParams,
  subscriptionUpdateBody,
  updateSubscription,
} from "./pv.controller.js";
import { publicFormRateLimit } from "../../middlewares/rate-limit.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import { validate } from "../../middlewares/validate.js";

export const pvRouter = Router();

// Every route is for leaders; the controller checks the leader's position on each request.
pvRouter.get("/registration/context", requireAuth, registrationContext);
pvRouter.get("/registration/children", requireAuth, validate({ query: childrenQuery }), childOrganisations);
pvRouter.get("/registration/price", requireAuth, validate({ query: priceQuery }), registrationPrice);
pvRouter.post("/registrations", requireAuth, validate({ body: registrationBody }), createRegistration);
pvRouter.get("/registrations", requireAuth, validate({ query: registrationsQuery }), listRegistrations);
pvRouter.get("/analytics", requireAuth, validate({ query: analyticsQuery }), registrationAnalytics);
pvRouter.get("/subscribers/lookup", requireAuth, validate({ query: lookupQuery }), lookupSubscribers);
pvRouter.get("/renewals", requireAuth, validate({ query: renewalsQuery }), listRenewals);
pvRouter.get(
  "/public-registrations",
  requireAuth,
  validate({ query: publicRegistrationsQuery }),
  listPublicRegistrations,
);
pvRouter.post(
  "/public-registrations/:subscriber_id/approve",
  requireAuth,
  validate({ params: subscriberParams }),
  approvePublicRegistration,
);
pvRouter.post(
  "/public-registrations/:subscriber_id/reject",
  requireAuth,
  validate({ params: subscriberParams, body: rejectBody }),
  rejectPublicRegistration,
);
pvRouter.get(
  "/subscribers/:subscriber_id",
  requireAuth,
  validate({ params: subscriberParams, query: subscriberViewQuery }),
  subscriberDetails,
);
pvRouter.put(
  "/subscribers/:subscriber_id/subscriptions/:year",
  requireAuth,
  validate({ params: subscriptionParams, body: subscriptionUpdateBody }),
  updateSubscription,
);

// A leader's public registration link: no login. root_id is the leader's place the link was made for.
export const pvPublicRouter = Router();

pvPublicRouter.get("/links/:root_id", validate({ params: publicRootParams }), publicContext);
pvPublicRouter.get(
  "/links/:root_id/children",
  validate({ params: publicRootParams, query: publicChildrenQuery }),
  publicChildren,
);
pvPublicRouter.get("/links/:root_id/price", validate({ params: publicRootParams, query: publicPriceQuery }), publicPrice);
pvPublicRouter.post(
  "/registrations",
  publicFormRateLimit,
  validate({ body: publicRegistrationBody }),
  createPublicRegistration,
);
