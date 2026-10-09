import type { Request, Response } from "express";
import { body, param, query } from "express-validator";
import { z } from "zod";
import { prisma } from "../../db/index.js";
import { AppError } from "../../utils/app-error.js";
import {
  organisationChain,
  resolveOrganisationSummaries,
  type OrganisationLevel,
} from "../../utils/reference-data.js";
import { handleError, sendSuccess } from "../../utils/response.js";
import { validate } from "../../utils/validate.js";


/* ------------------------------------------------------------------ request schemas */

// '' and whitespace-only values count as "not given", so an empty form field is never saved as ''.
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `Please enter ${label}.` })
    .trim()
    .min(1, `Please enter ${label}.`)
    .max(max, `${label[0]!.toUpperCase()}${label.slice(1)} is too long.`);

const optionalText = (label: string, max: number) =>
  z.preprocess(blankToUndefined, requiredText(label, max).optional());

// Country codes are stored as digits without '+', e.g. "971".
const countryCode = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .transform((value) => value.replace(/^\+/, ""))
    .pipe(z.string().regex(/^\d{1,4}$/, message));

const phoneNumber = (message: string) =>
  z
    .string({ error: message })
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^\d{6,15}$/, message));

const positiveId = (message: string) => z.coerce.number({ error: message }).int(message).positive(message);

export const SUBSCRIPTION_MODES = ["Print", "Digital", "Print&Digital"] as const;
export type SubscriptionMode = (typeof SUBSCRIPTION_MODES)[number];

export const childrenQuery = z.strictObject({
  parent_id: positiveId("Please choose a place in the hierarchy."),
});

export const priceQuery = z.strictObject({
  unit_id: positiveId("Please choose a unit."),
});

// The subscriber and subscription fields shared by the leader's form and the public form. Year,
// currency, amount, approval and who added it are set on the server; they are not accepted.
const subscriberFields = {
  unitId: positiveId("Please choose a unit."),
  name: requiredText("the full name", 500),
  shopName: optionalText("the flat/villa/shop name", 500),
  floorNo: optionalText("the floor number", 500),
  buildingName: requiredText("the building name", 500),
  street: optionalText("the street", 500),
  area: optionalText("the area", 500),
  province: requiredText("the state/province/emirate", 500),
  mobileCountry: countryCode("Please choose the mobile country code."),
  mobile: phoneNumber("Please enter a valid mobile number."),
  whatsappCountry: z.preprocess(blankToUndefined, countryCode("Please choose the WhatsApp country code.").optional()),
  whatsapp: z.preprocess(blankToUndefined, phoneNumber("Please enter a valid WhatsApp number.").optional()),
  email: z.preprocess(
    (value) => blankToUndefined(typeof value === "string" ? value.trim() : value),
    z.email("Please enter a valid email address.").max(320, "Email is too long.").optional(),
  ),
  contactPersonName: optionalText("the contact person / sponsor", 500),
  subscriptionMode: z.enum(SUBSCRIPTION_MODES, { error: "Please choose a subscription mode." }),
  distributorArea: optionalText("the distribution lead", 500),
  deliveryResponsibility: optionalText("the delivery responsibility", 500),
};

// Rules across fields, for both forms.
function subscriberRules(
  body: { whatsapp?: string; whatsappCountry?: string; deliveryResponsibility?: string; subscriptionMode: SubscriptionMode },
  ctx: z.RefinementCtx,
) {
  if (body.whatsapp && !body.whatsappCountry) {
    ctx.addIssue({ code: "custom", message: "Please choose the WhatsApp country code.", path: ["whatsappCountry"] });
  }
  if (body.deliveryResponsibility && body.subscriptionMode === "Digital") {
    ctx.addIssue({
      code: "custom",
      message: "Delivery responsibility is only for subscriptions that include Print.",
      path: ["deliveryResponsibility"],
    });
  }
}

// Entered by a leader.
export const registrationBody = z
  .strictObject({
    ...subscriberFields,
    cashReceived: z.enum(["Y", "N"], { error: "Please answer whether cash was received." }).default("N"),
    // Set when renewing an existing subscriber (found with the lookup); absent for a new one.
    subscriberId: positiveId("Please choose the subscriber again.").optional(),
  })
  .superRefine(subscriberRules);

// Entered by anyone through a leader's public link. rootId is the place the link was made for;
// the unit must be inside it. There is no cash received and no existing-subscriber renewal.
export const publicRegistrationBody = z
  .strictObject({
    rootId: positiveId("This registration link is not valid."),
    ...subscriberFields,
  })
  .superRefine(subscriberRules);

const subscriptionYear = z.coerce
  .number({ error: "Please choose a valid year." })
  .int("Please choose a valid year.")
  .min(2000, "Please choose a valid year.")
  .max(2100, "Please choose a valid year.");

// Without a year, the latest year that has subscriptions in the leader's branch is used. org_id
// opens the report for a place below the leader's own (drill-down); without it, the leader's place.
export const analyticsQuery = z.strictObject({
  year: subscriptionYear.optional(),
  org_id: positiveId("Please choose a place.").optional(),
});

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(10);
const listSearch = z.preprocess(blankToUndefined, z.string().trim().max(100, "That search is too long.").optional());

// Last year's subscribers, to renew this year.
export const renewalsQuery = z.strictObject({
  status: z.enum(["all", "renew", "renewed"]).default("all"),
  search: listSearch,
  page,
  page_size: pageSize,
});

export const publicRegistrationsQuery = z.strictObject({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  page,
  page_size: pageSize,
});

// A public registration is the subscriber's only subscription, so their id identifies it.
export const subscriberParams = z.strictObject({
  subscriber_id: positiveId("Subscriber not found."),
});

// One subscriber's view page: which year's subscription to show (default: the latest).
export const subscriberViewQuery = z.strictObject({
  year: subscriptionYear.optional(),
});

export const subscriptionParams = z.strictObject({
  subscriber_id: positiveId("Subscriber not found."),
  year: subscriptionYear,
});

// Editing a subscription: the leader's form without renewal. Type, method, approval and year
// stay as they are; currency and amount are worked out again from the unit and mode.
export const subscriptionUpdateBody = z
  .strictObject({
    ...subscriberFields,
    cashReceived: z.enum(["Y", "N"], { error: "Please answer whether cash was received." }).default("N"),
  })
  .superRefine(subscriberRules);

export const rejectBody = z.strictObject({
  reason: requiredText("the reason for rejecting", 500),
});

export const registrationsQuery = z.strictObject({
  year: subscriptionYear.optional(),
  page,
  page_size: pageSize,
});

// One search box: a subscriber number (subscriber_id), a ledger number or a mobile number.
export const lookupQuery = z.strictObject({
  q: z
    .string({ error: "Please enter the subscriber number or mobile number." })
    .trim()
    .min(1, "Please enter the subscriber number or mobile number.")
    .max(100, "That search is too long."),
});

export type ChildrenQuery = z.infer<typeof childrenQuery>;
export type LookupQuery = z.infer<typeof lookupQuery>;
export type PriceQuery = z.infer<typeof priceQuery>;
export type RegistrationBody = z.infer<typeof registrationBody>;
export type AnalyticsQuery = z.infer<typeof analyticsQuery>;
export type RegistrationsQuery = z.infer<typeof registrationsQuery>;
export type RenewalsQuery = z.infer<typeof renewalsQuery>;
export type PublicRegistrationsQuery = z.infer<typeof publicRegistrationsQuery>;
export type PublicRegistrationBody = z.infer<typeof publicRegistrationBody>;
export type SubscriptionUpdateBody = z.infer<typeof subscriptionUpdateBody>;

function normalizeSubscriberBody(b: any) {
  if (!b) return b;
  const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

  return {
    ...b,
    name: typeof b.name === "string" ? b.name.trim() : b.name,
    shopName: blankToUndef(typeof b.shopName === "string" ? b.shopName.trim() : b.shopName),
    floorNo: blankToUndef(typeof b.floorNo === "string" ? b.floorNo.trim() : b.floorNo),
    buildingName: typeof b.buildingName === "string" ? b.buildingName.trim() : b.buildingName,
    street: blankToUndef(typeof b.street === "string" ? b.street.trim() : b.street),
    area: blankToUndef(typeof b.area === "string" ? b.area.trim() : b.area),
    province: typeof b.province === "string" ? b.province.trim() : b.province,
    mobileCountry: typeof b.mobileCountry === "string" ? b.mobileCountry.trim().replace(/^\+/, "") : b.mobileCountry,
    mobile: typeof b.mobile === "string" ? b.mobile.replace(/[\s()-]/g, "") : b.mobile,
    whatsappCountry: blankToUndef(typeof b.whatsappCountry === "string" ? b.whatsappCountry.trim().replace(/^\+/, "") : b.whatsappCountry),
    whatsapp: blankToUndef(typeof b.whatsapp === "string" ? b.whatsapp.replace(/[\s()-]/g, "") : b.whatsapp),
    email: blankToUndef(typeof b.email === "string" ? b.email.trim() : b.email),
    contactPersonName: blankToUndef(typeof b.contactPersonName === "string" ? b.contactPersonName.trim() : b.contactPersonName),
    distributorArea: blankToUndef(typeof b.distributorArea === "string" ? b.distributorArea.trim() : b.distributorArea),
    deliveryResponsibility: blankToUndef(typeof b.deliveryResponsibility === "string" ? b.deliveryResponsibility.trim() : b.deliveryResponsibility),
    cashReceived: b.cashReceived ?? "N",
  };
}

async function runSubscriberValidation(req: Request) {
  await body("unitId").isInt({ min: 1 }).withMessage("Please choose a unit.").run(req);
  await body("name")
    .custom((v) => typeof v === "string" && v.trim().length > 0)
    .withMessage("Please enter the full name.")
    .isLength({ max: 500 })
    .withMessage("The full name is too long.")
    .run(req);

  await body("shopName")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("The flat/villa/shop name is too long.")
    .run(req);

  await body("floorNo")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("The floor number is too long.")
    .run(req);

  await body("buildingName")
    .custom((v) => typeof v === "string" && v.trim().length > 0)
    .withMessage("Please enter the building name.")
    .isLength({ max: 500 })
    .withMessage("The building name is too long.")
    .run(req);

  await body("street")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("The street is too long.")
    .run(req);

  await body("area")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("The area is too long.")
    .run(req);

  await body("province")
    .custom((v) => typeof v === "string" && v.trim().length > 0)
    .withMessage("Please enter the state/province/emirate.")
    .isLength({ max: 500 })
    .withMessage("The state/province/emirate is too long.")
    .run(req);

  await body("mobileCountry")
    .custom((v) => typeof v === "string" && /^\d{1,4}$/.test(v.trim().replace(/^\+/, "")))
    .withMessage("Please choose the mobile country code.")
    .run(req);

  await body("mobile")
    .custom((v) => typeof v === "string" && /^\d{6,15}$/.test(v.replace(/[\s()-]/g, "")))
    .withMessage("Please enter a valid mobile number.")
    .run(req);

  await body("whatsappCountry")
    .optional({ values: "falsy" })
    .custom((v) => typeof v === "string" && /^\d{1,4}$/.test(v.trim().replace(/^\+/, "")))
    .withMessage("Please choose the WhatsApp country code.")
    .run(req);

  await body("whatsapp")
    .optional({ values: "falsy" })
    .custom((v) => typeof v === "string" && /^\d{6,15}$/.test(v.replace(/[\s()-]/g, "")))
    .withMessage("Please enter a valid WhatsApp number.")
    .run(req);

  await body("email")
    .optional({ values: "falsy" })
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email address.")
    .isLength({ max: 320 })
    .withMessage("Email is too long.")
    .run(req);

  await body("contactPersonName")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("The contact person / sponsor is too long.")
    .run(req);

  await body("subscriptionMode")
    .isIn(SUBSCRIPTION_MODES)
    .withMessage("Please choose a subscription mode.")
    .run(req);

  await body("distributorArea")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("The distribution lead is too long.")
    .run(req);

  await body("deliveryResponsibility")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("The delivery responsibility is too long.")
    .run(req);

  const whatsapp = typeof req.body?.whatsapp === "string" && req.body.whatsapp.trim() ? req.body.whatsapp.trim() : undefined;
  const whatsappCountry = typeof req.body?.whatsappCountry === "string" && req.body.whatsappCountry.trim() ? req.body.whatsappCountry.trim() : undefined;
  if (whatsapp && !whatsappCountry) {
    await body("whatsappCountry").custom(() => false).withMessage("Please choose the WhatsApp country code.").run(req);
  }

  const deliveryResp = typeof req.body?.deliveryResponsibility === "string" && req.body.deliveryResponsibility.trim() ? req.body.deliveryResponsibility.trim() : undefined;
  if (deliveryResp && req.body?.subscriptionMode === "Digital") {
    await body("deliveryResponsibility").custom(() => false).withMessage("Delivery responsibility is only for subscriptions that include Print.").run(req);
  }
}

/* ------------------------------------------------------------------ hierarchy and permission */

// hierarchy_names.hlevelname. Saudi has a Chapter level between National and Region; other
// countries go National -> Region -> (Division) -> Unit.
const LEVEL = {
  international: "International",
  chapter: "Chapter",
  region: "Region",
  division: "Division",
  unit: "Unit",
} as const;

// Cabinet positions at these levels may add subscribers.
const LEADER_LEVELS: ReadonlySet<string> = new Set([LEVEL.region, LEVEL.division, LEVEL.unit]);

// Levels offered in the organisation dropdowns, below a leader's own place.
const SELECTABLE_LEVELS: ReadonlySet<string> = new Set([LEVEL.chapter, LEVEL.region, LEVEL.division, LEVEL.unit]);

const NOT_A_LEADER = "Only Region, Division and Unit leaders can add subscribers.";

interface Leader {
  userId: number;
  organisation: OrganisationLevel;
  // From the top of the hierarchy down to the leader's own place.
  path: OrganisationLevel[];
}

// The caller as a leader: the session's committee position must still be a cabinet position this
// member holds, at Region, Division or Unit level. Re-read on every request, like /auth/me, so a
// lost position or a disabled account takes effect at once.
async function requireLeader(auth: Request["auth"]): Promise<Leader> {
  const userId = Number(auth?.userId);
  const position = auth?.position;

  if (!Number.isInteger(userId)) {
    throw AppError.unauthorized("Invalid token");
  }
  if (!position) {
    throw AppError.forbidden("Please select the committee position you are acting as.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, memberNo: true, active: true },
  });

  if (!user) {
    throw AppError.unauthorized("Member not found");
  }
  if (user.active !== 1) {
    throw AppError.unauthorized("Your login is disabled");
  }
  if (!user.memberNo) {
    throw AppError.forbidden(NOT_A_LEADER);
  }

  const [member, committeeRow] = await Promise.all([
    prisma.membershipMaster.findFirst({ where: { membershipNo: user.memberNo }, select: { mid: true } }),
    prisma.committeeMember.findUnique({
      where: { cmid: position.cmid },
      select: { cmemId: true, cdesignId: true, corgId: true },
    }),
  ]);

  if (!member || !committeeRow || committeeRow.cmemId !== member.mid || committeeRow.corgId !== position.orgid) {
    throw AppError.forbidden(NOT_A_LEADER);
  }

  const designation = await prisma.committeeDesignations.findUnique({
    where: { desid: committeeRow.cdesignId },
    select: { isCabinet: true },
  });

  if (designation?.isCabinet !== "Y") {
    throw AppError.forbidden(NOT_A_LEADER);
  }

  const path = await organisationChain(position.orgid);
  const organisation = path.at(-1);

  if (!organisation || organisation.id !== position.orgid || !LEADER_LEVELS.has(organisation.level ?? "")) {
    throw AppError.forbidden(NOT_A_LEADER);
  }

  return { userId: user.id, organisation, path };
}

// The chain of a place the leader asked about, refused unless the leader's own place is on it
// (the place is the leader's own, or below it).
async function requireInScope(leader: Leader, orgId: number): Promise<OrganisationLevel[]> {
  const chain = await organisationChain(orgId);

  if (!chain.some((place) => place.id === leader.organisation.id)) {
    throw AppError.forbidden("That place is outside your position.");
  }

  return chain;
}

async function requireUnitInScope(leader: Leader, unitId: number): Promise<OrganisationLevel> {
  const unit = (await requireInScope(leader, unitId)).at(-1);

  if (unit?.level !== LEVEL.unit) {
    throw AppError.badRequest("Please choose a unit.");
  }

  return unit;
}

// Every place in the branch under `rootId` (the place itself and everything below it), mapped to
// the place directly below the root it sits under (null for the root itself). Walked one level at
// a time; a place already seen is skipped, so a bad hparent loop cannot run forever.
async function branchUnder(rootId: number): Promise<Map<number, number | null>> {
  const branches = new Map<number, number | null>([[rootId, null]]);
  let frontier = [rootId];

  while (frontier.length > 0) {
    const rows = await prisma.organisationUnit.findMany({
      where: { hparent: { in: frontier } },
      select: { orgid: true, hparent: true },
    });
    frontier = [];
    for (const row of rows) {
      if (branches.has(row.orgid)) continue;
      branches.set(row.orgid, row.hparent === rootId ? row.orgid : (branches.get(row.hparent!) ?? null));
      frontier.push(row.orgid);
    }
  }

  return branches;
}

const branchOf = (leader: Leader) => branchUnder(leader.organisation.id);

// "unit_id IN (?, ?, ...)" for raw queries: one bound placeholder per id, never the ids themselves.
const inPlaceholders = (ids: readonly number[]) => ids.map(() => "?").join(", ");

// For display: the path from the country down, without the International level above it.
function displayPath(path: OrganisationLevel[]): OrganisationLevel[] {
  return path.filter((place) => place.level !== LEVEL.international);
}

/* ------------------------------------------------------------------ price */

interface OpenPrice {
  id: number;
  countryCode: string;
  year: number;
  currency: string;
  campaignStatus: string | null;
  prices: Record<SubscriptionMode, number | null>;
}

// The open (not Closed) vayana_subscription row for the unit's country. Exactly one must exist:
// none means no price is set, or the campaign is closed; two would make the price ambiguous.
async function openPriceForUnit(unitId: number): Promise<OpenPrice> {
  const unit = await prisma.organisationUnit.findUnique({ where: { orgid: unitId }, select: { countryCode: true } });
  const countryCode = unit?.countryCode?.trim().toUpperCase();

  if (!countryCode) {
    throw AppError.badRequest("This unit has no country set.");
  }

  const rows = await prisma.vayanaSubscription.findMany({
    where: { country: countryCode },
    select: {
      id: true,
      amount: true,
      priceDigital: true,
      pricePrintDigital: true,
      currency: true,
      year: true,
      campaignStatus: true,
    },
  });

  if (rows.length === 0) {
    throw AppError.badRequest("Subscription amount not set for this country.");
  }

  const open = rows.filter((row) => (row.campaignStatus ?? "").trim().toLowerCase() !== "closed");

  if (open.length === 0) {
    throw AppError.badRequest("The subscription campaign for this country is closed.");
  }
  if (open.length > 1) {
    throw AppError.badRequest("More than one subscription campaign is open for this country.");
  }

  const row = open[0]!;
  const year = Number(row.year?.trim());
  const currency = row.currency?.trim();

  if (!Number.isInteger(year) || !currency) {
    throw AppError.badRequest("Subscription amount not set for this country.");
  }

  // A price of 0 or below is treated as not set, so a subscription is never saved for nothing.
  const positive = (value: number | null) => (value !== null && value > 0 ? value : null);

  return {
    id: row.id,
    countryCode,
    year,
    currency,
    campaignStatus: row.campaignStatus,
    prices: {
      Print: positive(row.amount),
      Digital: positive(row.priceDigital),
      "Print&Digital": positive(row.pricePrintDigital),
    },
  };
}

const priceResponse = (price: OpenPrice) => ({
  country_code: price.countryCode,
  year: price.year,
  currency: price.currency,
  campaign_status: price.campaignStatus,
  prices: price.prices,
});

// The places directly below one place that a form's dropdown offers, by name.
async function selectablePlacesBelow(parentId: number): Promise<OrganisationLevel[]> {
  const rows = await prisma.organisationUnit.findMany({ where: { hparent: parentId }, select: { orgid: true } });
  const summaries = await resolveOrganisationSummaries(rows.map((row) => row.orgid));

  return [...summaries.values()]
    .filter((place) => SELECTABLE_LEVELS.has(place.level ?? ""))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

/* ------------------------------------------------------------------ matching existing subscribers */

const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

// Mobile numbers are compared as digits, without leading zeros or a repeated country code.
function mobileKey(countryCodeDigits: string, mobile: string | null | undefined): string {
  let number = digits(mobile).replace(/^0+/, "");
  if (countryCodeDigits && number.startsWith(countryCodeDigits) && number.length - countryCodeDigits.length >= 7) {
    number = number.slice(countryCodeDigits.length);
  }
  return number;
}

// Names are compared by their letters only, as the migration did.
const nameKey = (name: string | null | undefined) => (name ?? "").toLowerCase().replace(/[^a-z]/g, "");

// A subscriber with the same mobile and name is the same person (rule used by the migration too).
async function findExistingSubscriber(body: RegistrationBody): Promise<number | null> {
  const country = digits(body.mobileCountry);
  const mobile = mobileKey(country, body.mobile);
  const name = nameKey(body.name);

  const candidates = await prisma.pvSubscriptionMaster.findMany({
    where: { mobile: { endsWith: mobile.slice(-7) } },
    select: { subscriberId: true, name: true, mobile: true, mobileCountry: true },
  });

  const match = candidates.find((candidate) => {
    const candidateCountry = digits(candidate.mobileCountry);
    return (
      candidateCountry === country &&
      mobileKey(candidateCountry, candidate.mobile) === mobile &&
      nameKey(candidate.name) === name
    );
  });

  return match?.subscriberId ?? null;
}

/* ------------------------------------------------------------------ existing subscribers (renew) */

// The legacy data uses this ledger number as a placeholder on thousands of rows, so it never
// identifies anyone.
const PLACEHOLDER_LEDGER = "PV100000";

const MAX_LOOKUP_RESULTS = 20;

type HistoryRow = {
  subscriber_id: number;
  unit_id: number;
  subscription_year: number | null;
  subscription_mode: SubscriptionMode;
  shop_name: string | null;
  floor_no: string | null;
  building_name: string | null;
  street: string | null;
  area: string | null;
  province: string | null;
  distributor_area: string | null;
  delivery_responsibility: string | null;
  contact_person_name: string | null;
};

// Each subscriber's subscriptions, latest year first. Rejected ones are left out: they never
// counted as a subscription.
async function subscriptionHistory(subscriberIds: readonly number[]): Promise<Map<number, HistoryRow[]>> {
  const history = new Map<number, HistoryRow[]>();
  if (subscriberIds.length === 0) return history;

  const rows = await prisma.$queryRawUnsafe<HistoryRow[]>(
    `SELECT subscriber_id, unit_id, subscription_year, subscription_mode, shop_name, floor_no, building_name,
            street, area, province, distributor_area, delivery_responsibility, contact_person_name
     FROM pv_subscription_details
     WHERE subscriber_id IN (${inPlaceholders(subscriberIds)}) AND approval_status <> 'REJECTED'
     ORDER BY subscription_year DESC, created_at DESC`,
    ...subscriberIds,
  );

  for (const row of rows) {
    const list = history.get(row.subscriber_id) ?? [];
    list.push(row);
    history.set(row.subscriber_id, list);
  }
  return history;
}

// The year new subscriptions are taken for in the leader's country, or null while no campaign
// is open (saving is refused then anyway, with the reason).
async function openYearFor(orgId: number): Promise<number | null> {
  try {
    return (await openPriceForUnit(orgId)).year;
  } catch (error) {
    if (error instanceof AppError) return null;
    throw error;
  }
}

// The subscription a renewal starts from: the latest one before `year`, or the latest of all.
const previousSubscription = (rows: HistoryRow[], year: number | null) =>
  (year === null ? undefined : rows.find((row) => (row.subscription_year ?? 0) < year)) ?? rows[0];

type MasterMatch = {
  subscriberId: number;
  name: string;
  ledgerNo: string | null;
  mobileCountry: string | null;
  mobile: string | null;
  whatsappCountry: string | null;
  whatsapp: string | null;
  email: string | null;
};

const MASTER_SELECT = {
  subscriberId: true,
  name: true,
  ledgerNo: true,
  mobileCountry: true,
  mobile: true,
  whatsappCountry: true,
  whatsapp: true,
  email: true,
} as const;

// Subscribers matching the search as a subscriber number, a ledger number or a mobile number.
async function findSubscribers(search: string): Promise<MasterMatch[]> {
  const found = new Map<number, MasterMatch>();
  const add = (rows: MasterMatch[]) => rows.forEach((row) => found.set(row.subscriberId, row));

  if (/^\d{1,10}$/.test(search) && Number(search) <= 2_147_483_647) {
    const byId = await prisma.pvSubscriptionMaster.findUnique({
      where: { subscriberId: Number(search) },
      select: MASTER_SELECT,
    });
    if (byId) add([byId]);
  }

  if (search.toUpperCase() !== PLACEHOLDER_LEDGER) {
    add(await prisma.pvSubscriptionMaster.findMany({ where: { ledgerNo: search }, select: MASTER_SELECT, take: 50 }));
  }

  // Mobile: compared as digits, with or without the country code and leading zeros.
  if (digits(search).length >= 6) {
    const candidates = await prisma.pvSubscriptionMaster.findMany({
      where: { mobile: { endsWith: digits(search).slice(-7) } },
      select: MASTER_SELECT,
      take: 200,
    });
    add(
      candidates.filter((candidate) => {
        const country = digits(candidate.mobileCountry);
        return mobileKey(country, candidate.mobile) === mobileKey(country, search);
      }),
    );
  }

  return [...found.values()];
}

// A subscriber this leader may renew for `year`: their latest subscription is in the leader's
// branch, and they have none for `year` yet.
async function requireRenewable(leader: Leader, subscriberId: number, year: number) {
  const master = await prisma.pvSubscriptionMaster.findUnique({ where: { subscriberId }, select: MASTER_SELECT });
  const rows = master ? ((await subscriptionHistory([subscriberId])).get(subscriberId) ?? []) : [];

  if (!master || rows.length === 0) {
    throw AppError.badRequest("Subscriber not found. Search again, or add them as a new subscriber.");
  }
  if (!(await branchOf(leader)).has(rows[0]!.unit_id)) {
    throw AppError.forbidden("That subscriber is outside your position.");
  }
  if (rows.some((row) => row.subscription_year === year)) {
    throw AppError.badRequest(`This subscriber is already registered for ${year}.`);
  }

  return { master, previous: previousSubscription(rows, year)! };
}

// Address fields compared as trimmed, case-insensitive text; empty and missing are the same.
const ADDRESS_FIELDS = [
  ["shopName", "shop_name"],
  ["floorNo", "floor_no"],
  ["buildingName", "building_name"],
  ["street", "street"],
  ["area", "area"],
  ["province", "province"],
] as const;

const sameText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

const addressChanged = (body: RegistrationBody, previous: HistoryRow) =>
  ADDRESS_FIELDS.some(([field, column]) => !sameText(body[field], previous[column]));

// The places between the leader's place and a unit, top-down and ending with the unit: what the
// form's organisation dropdowns are set to. Empty for a Unit leader, whose unit is fixed.
async function pathBelow(rootId: number, unitId: number): Promise<OrganisationLevel[]> {
  const chain = await organisationChain(unitId);
  const index = chain.findIndex((place) => place.id === rootId);
  return index < 0 ? [] : chain.slice(index + 1);
}

// Existing subscribers as the lookup and the renew list return them: contact details, their
// previous subscription (to fill the form) and where it was, as dropdown choices below the leader.
async function describeSubscribers(
  leader: Leader,
  entries: { master: MasterMatch; rows: HistoryRow[] }[],
  openYear: number | null,
) {
  const previous = entries.map(({ rows }) => previousSubscription(rows, openYear)!);
  const [units, paths] = await Promise.all([
    resolveOrganisationSummaries(previous.map((row) => row.unit_id)),
    Promise.all(previous.map((row) => pathBelow(leader.organisation.id, row.unit_id))),
  ]);

  return entries.map(({ master, rows }, index) => {
    const last = previous[index]!;
    return {
      subscriber_id: master.subscriberId,
      name: master.name,
      ledger_no: master.ledgerNo,
      mobile_country: master.mobileCountry,
      mobile: master.mobile,
      whatsapp_country: master.whatsappCountry,
      whatsapp: master.whatsapp,
      email: master.email,
      already_registered_this_year: openYear !== null && rows.some((row) => row.subscription_year === openYear),
      previous: {
        year: last.subscription_year,
        unit: units.get(last.unit_id) ?? { id: last.unit_id, name: null, level: null },
        path: paths[index]!,
        subscription_mode: last.subscription_mode,
        shop_name: last.shop_name,
        floor_no: last.floor_no,
        building_name: last.building_name,
        street: last.street,
        area: last.area,
        province: last.province,
        distributor_area: last.distributor_area,
        delivery_responsibility: last.delivery_responsibility,
        contact_person_name: last.contact_person_name,
      },
    };
  });
}

/* ------------------------------------------------------------------ handlers */

// What the Add Subscriber form needs first: the leader's place, the fixed path above it, and
// whether a unit still has to be chosen (a Unit leader's own unit is fixed).
export const registrationContext = async (req: Request, res: Response) => {
  try {
    const leader = await requireLeader(req.user ?? req.auth);

    return sendSuccess(res, "Registration context fetched successfully", {
      leader: leader.organisation,
      path: displayPath(leader.path),
      choose_unit: leader.organisation.level !== LEVEL.unit,
    });
  } catch (error) {
    return handleError(res, error, "PV registration context error:");
  }
};

// The places directly below one place in the leader's branch, for the next dropdown.
export const childOrganisations = async (req: Request, res: Response) => {
  try {
    await query("parent_id").isInt({ min: 1 }).withMessage("Please choose a place in the hierarchy.").run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const parentId = Number(req.query.parent_id ?? (req as any).validated?.query?.parent_id);

    const parent = (await requireInScope(leader, parentId)).at(-1);
    if (parent?.level === LEVEL.unit) {
      return sendSuccess(res, "Places fetched successfully", { places: [] });
    }

    return sendSuccess(res, "Places fetched successfully", { places: await selectablePlacesBelow(parentId) });
  } catch (error) {
    return handleError(res, error, "PV child organisations error:");
  }
};

// Currency and the price of each mode for a unit, from the open campaign of its country.
export const registrationPrice = async (req: Request, res: Response) => {
  try {
    await query("unit_id").isInt({ min: 1 }).withMessage("Please choose a unit.").run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const unitId = Number(req.query.unit_id ?? (req as any).validated?.query?.unit_id);

    await requireUnitInScope(leader, unitId);
    const price = await openPriceForUnit(unitId);

    return sendSuccess(res, "Price fetched successfully", priceResponse(price));
  } catch (error) {
    return handleError(res, error, "PV price error:");
  }
};

// "Is Existing Subscriber" search: subscribers whose latest subscription is in the leader's
// branch, each with their previous subscription (to fill the form) and whether they are already
// registered for the open campaign year.
export const lookupSubscribers = async (req: Request, res: Response) => {
  try {
    await query("q")
      .trim()
      .notEmpty()
      .withMessage("Please enter the subscriber number or mobile number.")
      .isLength({ max: 100 })
      .withMessage("That search is too long.")
      .run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const q = String(req.query.q ?? (req as any).validated?.query?.q).trim();

    const matches = await findSubscribers(q);
    const [history, branches, openYear] = await Promise.all([
      subscriptionHistory(matches.map((match) => match.subscriberId)),
      branchOf(leader),
      openYearFor(leader.organisation.id),
    ]);

    const inBranch = matches
      .map((master) => ({ master, rows: history.get(master.subscriberId) ?? [] }))
      .filter(({ rows }) => rows.length > 0 && branches.has(rows[0]!.unit_id))
      .slice(0, MAX_LOOKUP_RESULTS);

    const subscribers = await describeSubscribers(leader, inBranch, openYear);

    return sendSuccess(res, "Subscribers fetched successfully", { year: openYear, subscribers });
  } catch (error) {
    return handleError(res, error, "PV subscriber lookup error:");
  }
};

// Saves this year's subscription: for a new subscriber (also creating them), or a renewal of an
// existing one (subscriberId sent; their contact details are updated from the form). The server
// decides the year, currency and amount (from the open campaign) and records the leader as adder
// and approver.
export const createRegistration = async (req: Request, res: Response) => {
  try {
    await runSubscriberValidation(req);
    await body("cashReceived")
      .optional({ values: "falsy" })
      .isIn(["Y", "N"])
      .withMessage("Please answer whether cash was received.")
      .run(req);
    await body("subscriberId")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Please choose the subscriber again.")
      .run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const data = normalizeSubscriberBody(req.body) as RegistrationBody;


    await requireUnitInScope(leader, data.unitId);
    const price = await openPriceForUnit(data.unitId);

    const amount = price.prices[data.subscriptionMode];
    if (amount === null) {
      throw AppError.badRequest("Subscription amount not set for this country.");
    }

    const renewal = data.subscriberId ? await requireRenewable(leader, data.subscriberId, price.year) : null;

    if (!renewal && (await findExistingSubscriber(data)) !== null) {
      throw AppError.badRequest(
        "This subscriber is already registered. Use \"Is Existing Subscriber\" to find and renew them.",
      );
    }

    const contact = {
      name: data.name,
      mobileCountry: data.mobileCountry,
      mobile: data.mobile,
      whatsappCountry: data.whatsapp ? data.whatsappCountry : null,
      whatsapp: data.whatsapp ?? null,
      email: data.email ?? null,
    };
    const registrationType = renewal ? "RENEW" : "NEW";
    const previousYearUser = renewal ? "Yes" : "No";
    const addressChange = renewal && addressChanged(data, renewal.previous) ? "Yes" : "No";

    const now = new Date();
    const subscriberId = await prisma.$transaction(async (tx) => {
      const master = renewal
        ? await tx.pvSubscriptionMaster.update({
            where: { subscriberId: renewal.master.subscriberId },
            data: contact,
            select: { subscriberId: true, ledgerNo: true },
          })
        : await tx.pvSubscriptionMaster.create({
            data: { ...contact, status: "ACTIVE", firstSubscribedAt: now },
            select: { subscriberId: true, ledgerNo: true },
          });

      // pv_subscription_details has no primary key, so it is not a Prisma model. The tagged
      // template sends every value as a bound parameter.
      await tx.$executeRaw`
        INSERT INTO pv_subscription_details (
          subscriber_id, subscription_id, unit_id,
          registration_type, registration_method, approval_status, approved_by, approved_at,
          previous_year_user, subscription_year, subscription_mode, quantity,
          currency, amount, cash_received,
          shop_name, floor_no, building_name, street, area, province, address_change,
          distributor_area, delivery_responsibility, contact_person_name, ledger_no,
          added_by, created_at
        ) VALUES (
          ${master.subscriberId}, ${price.id}, ${data.unitId},
          ${registrationType}, 'DIRECT', 'APPROVED', ${leader.userId}, ${now},
          ${previousYearUser}, ${price.year}, ${data.subscriptionMode}, 1,
          ${price.currency}, ${amount}, ${data.cashReceived},
          ${data.shopName ?? null}, ${data.floorNo ?? null}, ${data.buildingName}, ${data.street ?? null},
          ${data.area ?? null}, ${data.province}, ${addressChange},
          ${data.distributorArea ?? null}, ${data.deliveryResponsibility ?? null}, ${data.contactPersonName ?? null},
          ${master.ledgerNo ?? null},
          ${leader.userId}, ${now}
        )`;

      return master.subscriberId;
    });

    return sendSuccess(
      res,
      renewal ? "Subscription renewed successfully" : "Subscriber added successfully",
      {
        subscriber_id: subscriberId,
        registration_type: registrationType,
        subscription_year: price.year,
        currency: price.currency,
        amount,
      },
      201,
    );
  } catch (error) {
    return handleError(res, error, "PV create registration error:");
  }
};

/* ------------------------------------------------------------------ registrations and analytics */

// Years that have subscriptions in these places, latest first.
async function subscriptionYears(placeIds: readonly number[]): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<{ year: number | null }[]>(
    `SELECT DISTINCT subscription_year AS year FROM pv_subscription_details
     WHERE unit_id IN (${inPlaceholders(placeIds)}) AND subscription_year IS NOT NULL
     ORDER BY year DESC`,
    ...placeIds,
  );
  return rows.map((row) => Number(row.year));
}

type AnalyticsRow = {
  unit_id: number;
  registration_type: string;
  subscription_mode: SubscriptionMode;
  currency: string | null;
  cash_received: string | null;
  count: bigint | number;
  amount: unknown;
};

// The progress numbers of one place (or of all of a report together).
type Progress = {
  subscriptions: number;
  new: number;
  renewals: number;
  // Last year's subscribers there: the most that could renew this year.
  renewable: number;
  paid: number;
  membership: number;
  total_units: number;
};

const emptyProgress = (): Progress => ({
  subscriptions: 0,
  new: 0,
  renewals: 0,
  renewable: 0,
  paid: 0,
  membership: 0,
  total_units: 0,
});

// Target is the membership count (docs/TASKS.md C13); progress is subscriptions ÷ target, or
// null when there is no target, so nothing divides by zero.
const withTarget = (progress: Progress) => ({
  ...progress,
  target: progress.membership,
  progress: progress.membership > 0 ? progress.subscriptions / progress.membership : null,
});

// Work progress for one year in a place: the leader's own, or (org_id) one below it. Totals for
// the place, each place directly below it, and the split by mode and currency. Only approved
// subscriptions count; "paid" is cash received (docs/TASKS.md C14).
export const registrationAnalytics = async (req: Request, res: Response) => {
  try {
    await query("year")
      .optional({ values: "falsy" })
      .isInt({ min: 2000, max: 2100 })
      .withMessage("Please choose a valid year.")
      .run(req);
    await query("org_id")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Please choose a place.")
      .run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const queryData = (req as any).validated?.query ?? req.query;
    const requestedYear = queryData.year !== undefined && queryData.year !== "" ? Number(queryData.year) : undefined;
    const orgId = queryData.org_id !== undefined && queryData.org_id !== "" ? Number(queryData.org_id) : undefined;

    const rootId = orgId ?? leader.organisation.id;
    if (orgId !== undefined && orgId !== leader.organisation.id) {
      await requireInScope(leader, orgId);
    }

    const [branches, rootPath] = await Promise.all([branchUnder(rootId), organisationChain(rootId)]);
    const placeIds = [...branches.keys()];
    const years = await subscriptionYears(placeIds);
    const year = requestedYear ?? years[0] ?? null;

    const placeholders = inPlaceholders(placeIds);
    const [rows, lastYear, members, places] = await Promise.all([
      year === null
        ? []
        : prisma.$queryRawUnsafe<AnalyticsRow[]>(
            `SELECT unit_id, registration_type, subscription_mode, currency, cash_received,
                    COUNT(*) AS count, SUM(amount) AS amount
             FROM pv_subscription_details
             WHERE unit_id IN (${placeholders}) AND subscription_year = ? AND approval_status = 'APPROVED'
             GROUP BY unit_id, registration_type, subscription_mode, currency, cash_received`,
            ...placeIds,
            year,
          ),
      year === null
        ? []
        : prisma.$queryRawUnsafe<{ unit_id: number; count: bigint | number }[]>(
            `SELECT unit_id, COUNT(DISTINCT subscriber_id) AS count
             FROM pv_subscription_details
             WHERE unit_id IN (${placeholders}) AND subscription_year = ? AND approval_status = 'APPROVED'
             GROUP BY unit_id`,
            ...placeIds,
            year - 1,
          ),
      prisma.membershipMaster.groupBy({
        by: ["unitId"],
        where: { unitId: { in: placeIds }, active: 1 },
        _count: { _all: true },
      }),
      resolveOrganisationSummaries(placeIds),
    ]);

    // Every number is added to the report's totals and to the place below the root it sits under.
    const totals = emptyProgress();
    const byChild = new Map<number, Progress>();
    for (const [id, child] of branches) {
      if (child !== null && !byChild.has(child)) byChild.set(child, emptyProgress());
      if (places.get(id)?.level === LEVEL.unit) {
        totals.total_units += 1;
        if (child !== null) byChild.get(child)!.total_units += 1;
      }
    }
    const addTo = (unitId: number, add: (progress: Progress) => void) => {
      add(totals);
      const child = branches.get(unitId);
      if (child) add(byChild.get(child)!);
    };

    const byMode: Record<SubscriptionMode, number> = { Print: 0, Digital: 0, "Print&Digital": 0 };
    const amounts = new Map<string, { currency: string; total: number; received: number }>();

    for (const row of rows) {
      const count = Number(row.count);
      const amount = Number(row.amount ?? 0);
      const paid = row.cash_received === "Y";

      addTo(row.unit_id, (progress) => {
        progress.subscriptions += count;
        if (row.registration_type === "RENEW") progress.renewals += count;
        else progress.new += count;
        if (paid) progress.paid += count;
      });
      if (row.subscription_mode in byMode) byMode[row.subscription_mode] += count;

      const currency = row.currency?.trim() || "—";
      const money = amounts.get(currency) ?? { currency, total: 0, received: 0 };
      money.total += amount;
      if (paid) money.received += amount;
      amounts.set(currency, money);
    }
    for (const row of lastYear) {
      addTo(row.unit_id, (progress) => (progress.renewable += Number(row.count)));
    }
    for (const row of members) {
      addTo(row.unitId, (progress) => (progress.membership += row._count._all));
    }

    const rowsBelow = [...byChild]
      .map(([id, progress]) => ({ ...(places.get(id) ?? { id, name: null, level: null }), ...withTarget(progress) }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

    return sendSuccess(res, "Analytics fetched successfully", {
      year,
      years,
      scope: {
        place: rootPath.at(-1) ?? { id: rootId, name: null, level: null },
        path: displayPath(rootPath),
        // The leader's own place: the report can go up to here and no further.
        top_id: leader.organisation.id,
      },
      totals: withTarget(totals),
      by_mode: byMode,
      amounts: [...amounts.values()],
      places: rowsBelow,
    });
  } catch (error) {
    return handleError(res, error, "PV analytics error:");
  }
};

type RegistrationRow = {
  subscriber_id: number;
  name: string;
  mobile_country: string | null;
  mobile: string | null;
  unit_id: number;
  subscription_mode: SubscriptionMode;
  currency: string | null;
  amount: unknown;
  cash_received: string | null;
  approval_status: string;
  registration_method: string;
  created_at: Date | null;
};

// Approved new registrations (not renewals) for one year in the leader's branch, newest first.
export const listRegistrations = async (req: Request, res: Response) => {
  try {
    await query("year")
      .optional({ values: "falsy" })
      .isInt({ min: 2000, max: 2100 })
      .withMessage("Please choose a valid year.")
      .run(req);
    await query("page")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Page must be at least 1.")
      .run(req);
    await query("page_size")
      .optional({ values: "falsy" })
      .isInt({ min: 1, max: 100 })
      .withMessage("Page size must be between 1 and 100.")
      .run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const queryData = (req as any).validated?.query ?? req.query;
    const requestedYear = queryData.year !== undefined && queryData.year !== "" ? Number(queryData.year) : undefined;
    const page = queryData.page !== undefined && queryData.page !== "" ? Math.max(1, Number(queryData.page)) : 1;
    const pageSize = queryData.page_size !== undefined && queryData.page_size !== "" ? Math.min(100, Math.max(1, Number(queryData.page_size))) : 10;

    const placeIds = [...(await branchOf(leader)).keys()];
    const years = await subscriptionYears(placeIds);
    const year = requestedYear ?? years[0] ?? null;

    if (year === null) {
      return sendSuccess(res, "Registrations fetched successfully", {
        year,
        years,
        page,
        page_size: pageSize,
        total: 0,
        items: [],
      });
    }

    // Approved only: public registrations appear here once a leader approves them.
    const where = `d.unit_id IN (${inPlaceholders(placeIds)}) AND d.subscription_year = ? AND d.registration_type = 'NEW'
      AND d.approval_status = 'APPROVED'`;

    const [[counted], rows] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: bigint | number }[]>(
        `SELECT COUNT(*) AS total FROM pv_subscription_details d WHERE ${where}`,
        ...placeIds,
        year,
      ),
      prisma.$queryRawUnsafe<RegistrationRow[]>(
        `SELECT d.subscriber_id, m.name, m.mobile_country, m.mobile, d.unit_id, d.subscription_mode,
                d.currency, d.amount, d.cash_received, d.approval_status, d.registration_method, d.created_at
          FROM pv_subscription_details d
          JOIN pv_subscription_master m ON m.subscriber_id = d.subscriber_id
          WHERE ${where}
          ORDER BY d.created_at DESC, d.subscriber_id DESC
          LIMIT ? OFFSET ?`,
        ...placeIds,
        year,
        pageSize,
        (page - 1) * pageSize,
      ),
    ]);

    const units = await resolveOrganisationSummaries(rows.map((row) => row.unit_id));

    return sendSuccess(res, "Registrations fetched successfully", {
      year,
      years,
      page,
      page_size: pageSize,
      total: Number(counted?.total ?? 0),
      items: rows.map((row) => ({
        subscriber_id: row.subscriber_id,
        name: row.name,
        mobile_country: row.mobile_country,
        mobile: row.mobile,
        unit: units.get(row.unit_id) ?? { id: row.unit_id, name: null, level: null },
        subscription_mode: row.subscription_mode,
        currency: row.currency,
        amount: row.amount === null ? null : Number(row.amount),
        cash_received: row.cash_received,
        approval_status: row.approval_status,
        registration_method: row.registration_method,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    return handleError(res, error, "PV registrations list error:");
  }
};

/* ------------------------------------------------------------------ renew list */

// Last year's approved subscribers in the leader's branch, for renewing in the open campaign
// year: each marked renewed (already has a subscription this year) or not, with what the form
// needs to renew them. Without an open campaign, the latest year with subscriptions is used.
export const listRenewals = async (req: Request, res: Response) => {
  try {
    await query("status")
      .optional({ values: "falsy" })
      .isIn(["all", "renew", "renewed"])
      .withMessage("Invalid status.")
      .run(req);
    await query("search")
      .optional({ values: "falsy" })
      .isLength({ max: 100 })
      .withMessage("That search is too long.")
      .run(req);
    await query("page")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Page must be at least 1.")
      .run(req);
    await query("page_size")
      .optional({ values: "falsy" })
      .isInt({ min: 1, max: 100 })
      .withMessage("Page size must be between 1 and 100.")
      .run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const queryData = (req as any).validated?.query ?? req.query;
    const status = (queryData.status as "all" | "renew" | "renewed") || "all";
    const search = typeof queryData.search === "string" && queryData.search.trim() ? queryData.search.trim() : undefined;
    const page = queryData.page !== undefined && queryData.page !== "" ? Math.max(1, Number(queryData.page)) : 1;
    const pageSize = queryData.page_size !== undefined && queryData.page_size !== "" ? Math.min(100, Math.max(1, Number(queryData.page_size))) : 10;

    const placeIds = [...(await branchOf(leader)).keys()];
    const year = (await openYearFor(leader.organisation.id)) ?? (await subscriptionYears(placeIds))[0] ?? null;

    if (year === null) {
      return sendSuccess(res, "Renewals fetched successfully", { year, page, page_size: pageSize, total: 0, items: [] });
    }

    const renewed = `EXISTS (SELECT 1 FROM pv_subscription_details r
      WHERE r.subscriber_id = d.subscriber_id AND r.subscription_year = ? AND r.approval_status <> 'REJECTED')`;
    const conditions = [
      `d.unit_id IN (${inPlaceholders(placeIds)})`,
      "d.subscription_year = ?",
      "d.approval_status = 'APPROVED'",
    ];
    const values: (number | string)[] = [...placeIds, year - 1];

    if (search) {
      conditions.push("(m.name LIKE ? OR m.mobile LIKE ? OR m.ledger_no = ?)");
      values.push(`%${search}%`, `%${digits(search) || search}%`, search);
    }
    if (status !== "all") {
      conditions.push(status === "renewed" ? renewed : `NOT ${renewed}`);
      values.push(year);
    }
    const where = conditions.join(" AND ");

    const [[counted], rows] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: bigint | number }[]>(
        `SELECT COUNT(DISTINCT d.subscriber_id) AS total
         FROM pv_subscription_details d JOIN pv_subscription_master m ON m.subscriber_id = d.subscriber_id
         WHERE ${where}`,
        ...values,
      ),
      prisma.$queryRawUnsafe<{ subscriber_id: number }[]>(
        `SELECT DISTINCT d.subscriber_id, m.name
         FROM pv_subscription_details d JOIN pv_subscription_master m ON m.subscriber_id = d.subscriber_id
         WHERE ${where}
         ORDER BY m.name, d.subscriber_id
         LIMIT ? OFFSET ?`,
        ...values,
        pageSize,
        (page - 1) * pageSize,
      ),
    ]);

    const ids = rows.map((row) => Number(row.subscriber_id));
    const [masters, history] = await Promise.all([
      prisma.pvSubscriptionMaster.findMany({ where: { subscriberId: { in: ids } }, select: MASTER_SELECT }),
      subscriptionHistory(ids),
    ]);
    const masterById = new Map(masters.map((master) => [master.subscriberId, master]));
    const entries = ids.flatMap((id) => {
      const master = masterById.get(id);
      const subscriptions = history.get(id) ?? [];
      return master && subscriptions.length > 0 ? [{ master, rows: subscriptions }] : [];
    });

    return sendSuccess(res, "Renewals fetched successfully", {
      year,
      page,
      page_size: pageSize,
      total: Number(counted?.total ?? 0),
      items: await describeSubscribers(leader, entries, year),
    });
  } catch (error) {
    return handleError(res, error, "PV renewals error:");
  }
};

/* ------------------------------------------------------------------ public registrations (leader side) */

type PublicRow = RegistrationRow & {
  subscription_year: number | null;
  reject_reason: string | null;
  building_name: string | null;
  area: string | null;
  province: string | null;
};

// Registrations that came through a public link, in the leader's branch: pending first, then
// newest first.
export const listPublicRegistrations = async (req: Request, res: Response) => {
  try {
    await query("status")
      .optional({ values: "falsy" })
      .isIn(["PENDING", "APPROVED", "REJECTED"])
      .withMessage("Invalid status.")
      .run(req);
    await query("page")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Page must be at least 1.")
      .run(req);
    await query("page_size")
      .optional({ values: "falsy" })
      .isInt({ min: 1, max: 100 })
      .withMessage("Page size must be between 1 and 100.")
      .run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const queryData = (req as any).validated?.query ?? req.query;
    const status = (queryData.status as "PENDING" | "APPROVED" | "REJECTED") || "PENDING";
    const page = queryData.page !== undefined && queryData.page !== "" ? Math.max(1, Number(queryData.page)) : 1;
    const pageSize = queryData.page_size !== undefined && queryData.page_size !== "" ? Math.min(100, Math.max(1, Number(queryData.page_size))) : 10;

    const placeIds = [...(await branchOf(leader)).keys()];
    const where = `d.unit_id IN (${inPlaceholders(placeIds)}) AND d.registration_method = 'PUBLIC' AND d.approval_status = ?`;

    const [[counted], rows] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: bigint | number }[]>(
        `SELECT COUNT(*) AS total FROM pv_subscription_details d WHERE ${where}`,
        ...placeIds,
        status,
      ),
      prisma.$queryRawUnsafe<PublicRow[]>(
        `SELECT d.subscriber_id, m.name, m.mobile_country, m.mobile, d.unit_id, d.subscription_mode,
                d.currency, d.amount, d.cash_received, d.approval_status, d.registration_method, d.created_at,
                d.subscription_year, d.reject_reason, d.building_name, d.area, d.province
         FROM pv_subscription_details d
         JOIN pv_subscription_master m ON m.subscriber_id = d.subscriber_id
         WHERE ${where}
         ORDER BY d.created_at DESC, d.subscriber_id DESC
         LIMIT ? OFFSET ?`,
        ...placeIds,
        status,
        pageSize,
        (page - 1) * pageSize,
      ),
    ]);

    const units = await resolveOrganisationSummaries(rows.map((row) => row.unit_id));

    return sendSuccess(res, "Public registrations fetched successfully", {
      status,
      page,
      page_size: pageSize,
      total: Number(counted?.total ?? 0),
      items: rows.map((row) => ({
        subscriber_id: row.subscriber_id,
        name: row.name,
        mobile_country: row.mobile_country,
        mobile: row.mobile,
        unit: units.get(row.unit_id) ?? { id: row.unit_id, name: null, level: null },
        subscription_year: row.subscription_year,
        subscription_mode: row.subscription_mode,
        currency: row.currency,
        amount: row.amount === null ? null : Number(row.amount),
        address: [row.building_name, row.area, row.province].filter(Boolean).join(", "),
        approval_status: row.approval_status,
        reject_reason: row.reject_reason,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    return handleError(res, error, "PV public registrations error:");
  }
};

// The pending public registration of a subscriber, refused unless its unit is in the leader's
// branch. Decided ones cannot be decided again.
async function requirePendingPublic(leader: Leader, subscriberId: number) {
  const [row] = await prisma.$queryRawUnsafe<{ unit_id: number; approval_status: string }[]>(
    `SELECT unit_id, approval_status FROM pv_subscription_details
     WHERE subscriber_id = ? AND registration_method = 'PUBLIC'
     ORDER BY created_at DESC LIMIT 1`,
    subscriberId,
  );

  if (!row) {
    throw AppError.notFound("Registration not found.");
  }
  if (!(await branchOf(leader)).has(row.unit_id)) {
    throw AppError.forbidden("That registration is outside your position.");
  }
  if (row.approval_status !== "PENDING") {
    throw AppError.badRequest(`This registration is already ${row.approval_status.toLowerCase()}.`);
  }
}

// Approve: the subscription counts from now on, and the leader is recorded as approver and adder.
export const approvePublicRegistration = async (req: Request, res: Response) => {
  try {
    await param("subscriber_id").isInt({ min: 1 }).withMessage("Subscriber not found.").run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const subscriberId = Number(req.params.subscriber_id ?? (req as any).validated?.params?.subscriber_id);

    await requirePendingPublic(leader, subscriberId);

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE pv_subscription_details
        SET approval_status = 'APPROVED', approved_by = ${leader.userId}, approved_at = ${now}, added_by = ${leader.userId}
        WHERE subscriber_id = ${subscriberId} AND registration_method = 'PUBLIC' AND approval_status = 'PENDING'`;
      await tx.pvSubscriptionMaster.update({
        where: { subscriberId },
        data: { status: "ACTIVE", firstSubscribedAt: now },
        select: { subscriberId: true },
      });
    });

    return sendSuccess(res, "Registration approved", { subscriber_id: subscriberId, approval_status: "APPROVED" });
  } catch (error) {
    return handleError(res, error, "PV approve error:");
  }
};

// Reject, with the reason shown in the list.
export const rejectPublicRegistration = async (req: Request, res: Response) => {
  try {
    await param("subscriber_id").isInt({ min: 1 }).withMessage("Subscriber not found.").run(req);
    await body("reason")
      .trim()
      .notEmpty()
      .withMessage("Please enter the reason for rejecting.")
      .isLength({ max: 500 })
      .withMessage("The reason for rejecting is too long.")
      .run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const subscriberId = Number(req.params.subscriber_id ?? (req as any).validated?.params?.subscriber_id);
    const { reason } = req.body as z.infer<typeof rejectBody>;

    await requirePendingPublic(leader, subscriberId);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE pv_subscription_details
        SET approval_status = 'REJECTED', reject_reason = ${reason}, approved_by = ${leader.userId}, approved_at = ${new Date()}
        WHERE subscriber_id = ${subscriberId} AND registration_method = 'PUBLIC' AND approval_status = 'PENDING'`;
      await tx.pvSubscriptionMaster.update({
        where: { subscriberId },
        data: { status: "REJECTED" },
        select: { subscriberId: true },
      });
    });

    return sendSuccess(res, "Registration rejected", { subscriber_id: subscriberId, approval_status: "REJECTED" });
  } catch (error) {
    return handleError(res, error, "PV reject error:");
  }
};

/* ------------------------------------------------------------------ public link (no login) */

// A leader's public link is made for their own place: Region, Division or Unit.
async function requireLinkRoot(rootId: number): Promise<OrganisationLevel[]> {
  const path = await organisationChain(rootId);
  const root = path.at(-1);

  if (!root || root.id !== rootId || !LEADER_LEVELS.has(root.level ?? "")) {
    throw AppError.notFound("This registration link is not valid.");
  }
  return path;
}

// The chain of a place asked about through a link, refused unless it is inside the link's place.
async function requireUnderRoot(rootId: number, orgId: number): Promise<OrganisationLevel[]> {
  const chain = await organisationChain(orgId);
  if (!chain.some((place) => place.id === rootId)) {
    throw AppError.forbidden("That place is outside this registration link.");
  }
  return chain;
}

async function requireUnitUnderRoot(rootId: number, unitId: number): Promise<void> {
  if ((await requireUnderRoot(rootId, unitId)).at(-1)?.level !== LEVEL.unit) {
    throw AppError.badRequest("Please choose a unit.");
  }
}

export const publicRootParams = z.strictObject({
  root_id: positiveId("This registration link is not valid."),
});

export const publicChildrenQuery = z.strictObject({
  parent_id: positiveId("Please choose a place in the hierarchy."),
});

export const publicPriceQuery = priceQuery;

// What the public form needs first: the link's place, the fixed path above it, and whether a unit
// still has to be chosen. Same shape as the leader's registration context.
export const publicContext = async (req: Request, res: Response) => {
  try {
    await param("root_id").isInt({ min: 1 }).withMessage("This registration link is not valid.").run(req);
    if (!validate(req, res)) return;

    const rootId = Number(req.params.root_id ?? (req as any).validated?.params?.root_id);
    const path = await requireLinkRoot(rootId);
    const root = path.at(-1)!;

    return sendSuccess(res, "Registration link fetched successfully", {
      leader: root,
      path: displayPath(path),
      choose_unit: root.level !== LEVEL.unit,
    });
  } catch (error) {
    return handleError(res, error, "PV public context error:");
  }
};

export const publicChildren = async (req: Request, res: Response) => {
  try {
    await param("root_id").isInt({ min: 1 }).withMessage("This registration link is not valid.").run(req);
    await query("parent_id").isInt({ min: 1 }).withMessage("Please choose a place in the hierarchy.").run(req);
    if (!validate(req, res)) return;

    const rootId = Number(req.params.root_id ?? (req as any).validated?.params?.root_id);
    const parentId = Number(req.query.parent_id ?? (req as any).validated?.query?.parent_id);

    await requireLinkRoot(rootId);
    const parent = (await requireUnderRoot(rootId, parentId)).at(-1);

    const places = parent?.level === LEVEL.unit ? [] : await selectablePlacesBelow(parentId);
    return sendSuccess(res, "Places fetched successfully", { places });
  } catch (error) {
    return handleError(res, error, "PV public children error:");
  }
};

export const publicPrice = async (req: Request, res: Response) => {
  try {
    await param("root_id").isInt({ min: 1 }).withMessage("This registration link is not valid.").run(req);
    await query("unit_id").isInt({ min: 1 }).withMessage("Please choose a unit.").run(req);
    if (!validate(req, res)) return;

    const rootId = Number(req.params.root_id ?? (req as any).validated?.params?.root_id);
    const unitId = Number(req.query.unit_id ?? (req as any).validated?.query?.unit_id);

    await requireLinkRoot(rootId);
    await requireUnitUnderRoot(rootId, unitId);

    return sendSuccess(res, "Price fetched successfully", priceResponse(await openPriceForUnit(unitId)));
  } catch (error) {
    return handleError(res, error, "PV public price error:");
  }
};

// Saves a public registration: a new subscriber, PENDING until a leader over the unit approves it.
// Nobody is recorded as adder; cash received is No. A second pending registration with the same
// mobile for the same year is refused.
export const createPublicRegistration = async (req: Request, res: Response) => {
  try {
    await body("rootId").isInt({ min: 1 }).withMessage("This registration link is not valid.").run(req);
    await runSubscriberValidation(req);
    if (!validate(req, res)) return;

    const data = normalizeSubscriberBody(req.body) as PublicRegistrationBody;

    await requireLinkRoot(data.rootId);
    await requireUnitUnderRoot(data.rootId, data.unitId);
    const price = await openPriceForUnit(data.unitId);

    const amount = price.prices[data.subscriptionMode];
    if (amount === null) {
      throw AppError.badRequest("Subscription amount not set for this country.");
    }

    const [pending] = await prisma.$queryRawUnsafe<{ total: bigint | number }[]>(
      `SELECT COUNT(*) AS total
       FROM pv_subscription_details d JOIN pv_subscription_master m ON m.subscriber_id = d.subscriber_id
       WHERE d.registration_method = 'PUBLIC' AND d.approval_status = 'PENDING' AND d.subscription_year = ?
         AND m.mobile_country = ? AND m.mobile = ?`,
      price.year,
      data.mobileCountry,
      data.mobile,
    );
    if (Number(pending?.total ?? 0) > 0) {
      throw AppError.badRequest("A registration with this mobile number is already waiting for approval.");
    }

    const now = new Date();
    const subscriberId = await prisma.$transaction(async (tx) => {
      const master = await tx.pvSubscriptionMaster.create({
        data: {
          name: data.name,
          mobileCountry: data.mobileCountry,
          mobile: data.mobile,
          whatsappCountry: data.whatsapp ? data.whatsappCountry : null,
          whatsapp: data.whatsapp ?? null,
          email: data.email ?? null,
          status: "PENDING",
        },
        select: { subscriberId: true },
      });

      await tx.$executeRaw`
        INSERT INTO pv_subscription_details (
          subscriber_id, subscription_id, unit_id,
          registration_type, registration_method, approval_status,
          previous_year_user, subscription_year, subscription_mode, quantity,
          currency, amount, cash_received,
          shop_name, floor_no, building_name, street, area, province, address_change,
          distributor_area, delivery_responsibility, contact_person_name, created_at
        ) VALUES (
          ${master.subscriberId}, ${price.id}, ${data.unitId},
          'NEW', 'PUBLIC', 'PENDING',
          'No', ${price.year}, ${data.subscriptionMode}, 1,
          ${price.currency}, ${amount}, 'N',
          ${data.shopName ?? null}, ${data.floorNo ?? null}, ${data.buildingName}, ${data.street ?? null},
          ${data.area ?? null}, ${data.province}, 'No',
          ${data.distributorArea ?? null}, ${data.deliveryResponsibility ?? null}, ${data.contactPersonName ?? null},
          ${now}
        )`;

      return master.subscriberId;
    });

    return sendSuccess(
      res,
      "Registration received. It will be confirmed once the committee approves it.",
      { subscriber_id: subscriberId, subscription_year: price.year, currency: price.currency, amount, approval_status: "PENDING" },
      201,
    );
  } catch (error) {
    return handleError(res, error, "PV public registration error:");
  }
};

/* ------------------------------------------------------------------ subscriber view and edit */

type SubscriptionRow = HistoryRow & {
  registration_type: string;
  registration_method: string;
  approval_status: string;
  approved_by: number | null;
  approved_at: Date | null;
  reject_reason: string | null;
  previous_year_user: string | null;
  address_change: string | null;
  currency: string | null;
  amount: unknown;
  cash_received: string | null;
  ledger_no: string | null;
  added_by: number | null;
  created_at: Date | null;
  updated_at: Date | null;
};

// Every subscription of one subscriber, rejected ones included, latest year first.
async function allSubscriptions(subscriberId: number): Promise<SubscriptionRow[]> {
  return prisma.$queryRawUnsafe<SubscriptionRow[]>(
    `SELECT subscriber_id, unit_id, subscription_year, subscription_mode, shop_name, floor_no, building_name,
            street, area, province, distributor_area, delivery_responsibility, contact_person_name,
            registration_type, registration_method, approval_status, approved_by, approved_at, reject_reason,
            previous_year_user, address_change, currency, amount, cash_received, ledger_no, added_by,
            created_at, updated_at
     FROM pv_subscription_details
     WHERE subscriber_id = ?
     ORDER BY subscription_year DESC, created_at DESC`,
    subscriberId,
  );
}

// Whether the leader may edit this subscription: it is in their branch, it is for the open
// campaign year of its unit's country (earlier years are view-only) and it was not rejected.
async function editBlocker(row: SubscriptionRow): Promise<string | null> {
  if (row.approval_status === "REJECTED") return "A rejected registration cannot be edited.";
  const openYear = await openYearFor(row.unit_id);
  if (openYear === null || row.subscription_year !== openYear) {
    return "Only this year's subscription can be edited; earlier years are view-only.";
  }
  return null;
}

const amountOf = (value: unknown) => (value === null || value === undefined ? null : Number(value));

// The view page: the subscriber's contact details, one year's subscription in full, where it sits
// in the hierarchy, who added and approved it, and every year as history.
export const subscriberDetails = async (req: Request, res: Response) => {
  try {
    await param("subscriber_id").isInt({ min: 1 }).withMessage("Subscriber not found.").run(req);
    await query("year")
      .optional({ values: "falsy" })
      .isInt({ min: 2000, max: 2100 })
      .withMessage("Please choose a valid year.")
      .run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const subscriberId = Number(req.params.subscriber_id ?? (req as any).validated?.params?.subscriber_id);
    const queryData = (req as any).validated?.query ?? req.query;
    const year = queryData.year !== undefined && queryData.year !== "" ? Number(queryData.year) : undefined;

    const [master, rows] = await Promise.all([
      prisma.pvSubscriptionMaster.findUnique({ where: { subscriberId }, select: MASTER_SELECT }),
      allSubscriptions(subscriberId),
    ]);
    if (!master || rows.length === 0) {
      throw AppError.notFound("Subscriber not found.");
    }

    const row = year === undefined ? rows[0]! : rows.find((subscription) => subscription.subscription_year === year);
    if (!row) {
      throw AppError.notFound(`No subscription for ${year}.`);
    }
    // The subscription shown must be in the leader's branch; older years elsewhere are history only.
    const branch = await branchOf(leader);
    if (!branch.has(row.unit_id)) {
      throw AppError.forbidden("This subscriber is outside your position.");
    }

    const userIds = [row.added_by, row.approved_by].filter((id): id is number => id !== null);
    const [chain, units, users, blocker] = await Promise.all([
      organisationChain(row.unit_id),
      resolveOrganisationSummaries(rows.map((subscription) => subscription.unit_id)),
      userIds.length > 0
        ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
        : [],
      editBlocker(row),
    ]);
    const userName = (id: number | null) => (id === null ? null : (users.find((user) => user.id === id)?.name ?? null));

    return sendSuccess(res, "Subscriber fetched successfully", {
      subscriber: {
        subscriber_id: master.subscriberId,
        name: master.name,
        ledger_no: master.ledgerNo,
        mobile_country: master.mobileCountry,
        mobile: master.mobile,
        whatsapp_country: master.whatsappCountry,
        whatsapp: master.whatsapp,
        email: master.email,
      },
      subscription: {
        year: row.subscription_year,
        unit: units.get(row.unit_id) ?? { id: row.unit_id, name: null, level: null },
        path: displayPath(chain),
        // The dropdown choices below the leader's place, for the edit form.
        form_path: await pathBelow(leader.organisation.id, row.unit_id),
        subscription_mode: row.subscription_mode,
        shop_name: row.shop_name,
        floor_no: row.floor_no,
        building_name: row.building_name,
        street: row.street,
        area: row.area,
        province: row.province,
        distributor_area: row.distributor_area,
        delivery_responsibility: row.delivery_responsibility,
        contact_person_name: row.contact_person_name,
        currency: row.currency,
        amount: amountOf(row.amount),
        cash_received: row.cash_received,
        registration_type: row.registration_type,
        registration_method: row.registration_method,
        approval_status: row.approval_status,
        reject_reason: row.reject_reason,
        address_change: row.address_change,
        added_by: userName(row.added_by),
        approved_by: userName(row.approved_by),
        approved_at: row.approved_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      history: rows.map((subscription) => ({
        year: subscription.subscription_year,
        unit: units.get(subscription.unit_id) ?? { id: subscription.unit_id, name: null, level: null },
        subscription_mode: subscription.subscription_mode,
        currency: subscription.currency,
        amount: amountOf(subscription.amount),
        registration_type: subscription.registration_type,
        approval_status: subscription.approval_status,
      })),
      allowed_actions: { edit: blocker === null },
      edit_blocked_reason: blocker,
    });
  } catch (error) {
    return handleError(res, error, "PV subscriber details error:");
  }
};

// Saves an edit of this year's subscription: the subscriber's contact details and the
// subscription's unit, address, mode, distribution and cash received. Currency and amount are
// worked out again from the (possibly new) unit and mode.
export const updateSubscription = async (req: Request, res: Response) => {
  try {
    await param("subscriber_id").isInt({ min: 1 }).withMessage("Subscriber not found.").run(req);
    await param("year").isInt({ min: 2000, max: 2100 }).withMessage("Please choose a valid year.").run(req);
    await runSubscriberValidation(req);
    await body("cashReceived")
      .optional({ values: "falsy" })
      .isIn(["Y", "N"])
      .withMessage("Please answer whether cash was received.")
      .run(req);
    if (!validate(req, res)) return;

    const leader = await requireLeader(req.user ?? req.auth);
    const subscriberId = Number(req.params.subscriber_id ?? (req as any).validated?.params?.subscriber_id);
    const year = Number(req.params.year ?? (req as any).validated?.params?.year);
    const data = normalizeSubscriberBody(req.body) as SubscriptionUpdateBody;

    const row = (await allSubscriptions(subscriberId)).find((subscription) => subscription.subscription_year === year);
    if (!row) {
      throw AppError.notFound("Subscription not found.");
    }
    if (!(await branchOf(leader)).has(row.unit_id)) {
      throw AppError.forbidden("This subscriber is outside your position.");
    }
    const blocker = await editBlocker(row);
    if (blocker) {
      throw AppError.badRequest(blocker);
    }

    await requireUnitInScope(leader, data.unitId);
    const price = await openPriceForUnit(data.unitId);
    if (price.year !== year) {
      throw AppError.badRequest(`The campaign for that unit's country is for ${price.year}, not ${year}.`);
    }
    const amount = price.prices[data.subscriptionMode];
    if (amount === null) {
      throw AppError.badRequest("Subscription amount not set for this country.");
    }

    const duplicate = await findExistingSubscriber(data as RegistrationBody);
    if (duplicate !== null && duplicate !== subscriberId) {
      throw AppError.badRequest("Another subscriber already has this name and mobile number.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.pvSubscriptionMaster.update({
        where: { subscriberId },
        data: {
          name: data.name,
          mobileCountry: data.mobileCountry,
          mobile: data.mobile,
          whatsappCountry: data.whatsapp ? data.whatsappCountry : null,
          whatsapp: data.whatsapp ?? null,
          email: data.email ?? null,
        },
        select: { subscriberId: true },
      });

      await tx.$executeRaw`
        UPDATE pv_subscription_details
        SET unit_id = ${data.unitId}, subscription_id = ${price.id},
            subscription_mode = ${data.subscriptionMode}, currency = ${price.currency}, amount = ${amount},
            cash_received = ${data.cashReceived},
            shop_name = ${data.shopName ?? null}, floor_no = ${data.floorNo ?? null},
            building_name = ${data.buildingName}, street = ${data.street ?? null}, area = ${data.area ?? null},
            province = ${data.province}, distributor_area = ${data.distributorArea ?? null},
            delivery_responsibility = ${data.deliveryResponsibility ?? null},
            contact_person_name = ${data.contactPersonName ?? null}
        WHERE subscriber_id = ${subscriberId} AND subscription_year = ${year} AND approval_status <> 'REJECTED'`;
    });

    return sendSuccess(res, "Subscription updated successfully", {
      subscriber_id: subscriberId,
      subscription_year: year,
      currency: price.currency,
      amount,
    });
  } catch (error) {
    return handleError(res, error, "PV update subscription error:");
  }
};
