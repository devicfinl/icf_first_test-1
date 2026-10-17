import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

process.env.JWT_SECRET ??= "test-secret";

/* ------------------------------------------------------------------ fixture */

// hierarchy_names levels, and a small hierarchy:
//   Oman (UAE+QATAR+OMAN pattern): National -> Region -> Division -> Unit, plus a Region with units directly
//   Saudi (SAUDI pattern):          National -> Chapter -> Region -> Division -> Unit
type Org = { orgid: number; name: string; level: string; hparent: number | null; countryCode: string };
const ORGS: Org[] = [
  { orgid: 1, name: "ICF International", level: "International", hparent: null, countryCode: "" },
  { orgid: 2, name: "Oman", level: "National", hparent: 1, countryCode: "OM" },
  { orgid: 60, name: "Muscat", level: "Region", hparent: 2, countryCode: "OM" },
  { orgid: 70, name: "Bousher", level: "Division", hparent: 60, countryCode: "OM" },
  { orgid: 80, name: "Bousher Unit A", level: "Unit", hparent: 70, countryCode: "OM" },
  { orgid: 81, name: "Bousher Unit B", level: "Unit", hparent: 70, countryCode: "om" },
  { orgid: 61, name: "Sohar", level: "Region", hparent: 2, countryCode: "OM" },
  { orgid: 82, name: "Sohar Unit", level: "Unit", hparent: 61, countryCode: "OM" },
  // A unit that leaves country_code blank: its country comes from the places above it.
  { orgid: 84, name: "Sohar Unit B", level: "Unit", hparent: 61, countryCode: "" },
  { orgid: 3, name: "Saudi", level: "National", hparent: 1, countryCode: "SA" },
  { orgid: 30, name: "Riyadh Chapter", level: "Chapter", hparent: 3, countryCode: "SA" },
  { orgid: 62, name: "Riyadh Region", level: "Region", hparent: 30, countryCode: "SA" },
  { orgid: 71, name: "Riyadh Division", level: "Division", hparent: 62, countryCode: "SA" },
  { orgid: 83, name: "Riyadh Unit", level: "Unit", hparent: 71, countryCode: "SA" },
];
const orgById = new Map(ORGS.map((org) => [org.orgid, org]));

// Members and the committee position each holds (desid 5 is cabinet, 6 is not).
type Person = { userId: number; memberNo: string; mid: number; cmid: number; orgid: number; desid: number; active?: number };
const PEOPLE: Record<string, Person> = {
  divisionLeader: { userId: 1, memberNo: "OM0000001", mid: 1, cmid: 100, orgid: 70, desid: 5 },
  unitLeader: { userId: 2, memberNo: "OM0000002", mid: 2, cmid: 101, orgid: 80, desid: 5 },
  notCabinet: { userId: 3, memberNo: "OM0000003", mid: 3, cmid: 102, orgid: 60, desid: 6 },
  chapterLeader: { userId: 4, memberNo: "SA0000004", mid: 4, cmid: 103, orgid: 30, desid: 5 },
  nationalLeader: { userId: 5, memberNo: "OM0000005", mid: 5, cmid: 104, orgid: 2, desid: 5 },
  saudiUnitLeader: { userId: 6, memberNo: "SA0000006", mid: 6, cmid: 105, orgid: 83, desid: 5 },
  disabledLeader: { userId: 7, memberNo: "OM0000007", mid: 7, cmid: 106, orgid: 70, desid: 5, active: 0 },
  regionLeader: { userId: 8, memberNo: "OM0000008", mid: 8, cmid: 107, orgid: 60, desid: 5 },
};
const people = Object.values(PEOPLE);

// vayana_subscription: Oman's 2026 campaign is closed and 2027 is open; Saudi's only campaign is closed.
const PRICES = [
  { id: 40, country: "OM", currency: "OMR", year: "2026", campaignStatus: "Closed", amount: 5, priceDigital: 3.5, pricePrintDigital: 5 },
  { id: 41, country: "OM", currency: "OMR", year: "2027", campaignStatus: "Open", amount: 5, priceDigital: 3.5, pricePrintDigital: 6 },
  { id: 42, country: "SA", currency: "SAR", year: "2026", campaignStatus: "Closed", amount: 40, priceDigital: 40, pricePrintDigital: 40 },
];

// pv_subscription_details rows read by the list and analytics. Unit 82 (Sohar) is outside the
// Division leader's branch; the REJECTED row is listed but not counted in the analytics.
type SubRow = {
  subscriber_id: number; name: string; unit_id: number; year: number; type: "NEW" | "RENEW";
  mode: "Print" | "Digital" | "Print&Digital"; amount: number; cash: "Y" | "N"; status: string; created: string;
  method?: "DIRECT" | "PUBLIC";
};
const SUBS: SubRow[] = [
  { subscriber_id: 1, name: "Amal", unit_id: 80, year: 2027, type: "NEW", mode: "Digital", amount: 3.5, cash: "Y", status: "APPROVED", created: "2027-01-03" },
  { subscriber_id: 2, name: "Badr", unit_id: 81, year: 2027, type: "NEW", mode: "Print", amount: 5, cash: "N", status: "APPROVED", created: "2027-01-05" },
  { subscriber_id: 3, name: "Hind", unit_id: 81, year: 2027, type: "RENEW", mode: "Print&Digital", amount: 6, cash: "Y", status: "APPROVED", created: "2027-01-04" },
  { subscriber_id: 4, name: "Zaid", unit_id: 80, year: 2027, type: "NEW", mode: "Print", amount: 5, cash: "N", status: "REJECTED", created: "2027-01-01" },
  { subscriber_id: 5, name: "Omar", unit_id: 82, year: 2027, type: "NEW", mode: "Digital", amount: 3.5, cash: "Y", status: "APPROVED", created: "2027-01-02" },
  { subscriber_id: 6, name: "Laila", unit_id: 80, year: 2026, type: "NEW", mode: "Print", amount: 5, cash: "Y", status: "APPROVED", created: "2026-01-02" },
  // Public registrations: two waiting in the Division leader's branch, one outside it.
  { subscriber_id: 7, name: "Pat", unit_id: 81, year: 2027, type: "NEW", mode: "Digital", amount: 3.5, cash: "N", status: "PENDING", created: "2027-01-06", method: "PUBLIC" },
  { subscriber_id: 8, name: "Rae", unit_id: 80, year: 2027, type: "NEW", mode: "Digital", amount: 3.5, cash: "N", status: "PENDING", created: "2027-01-07", method: "PUBLIC" },
  { subscriber_id: 9, name: "Sam", unit_id: 82, year: 2027, type: "NEW", mode: "Digital", amount: 3.5, cash: "N", status: "PENDING", created: "2027-01-08", method: "PUBLIC" },
];

// Active members per unit (the analytics target).
const MEMBERS: Record<number, number> = { 80: 10, 81: 6, 82: 4 };

// Answers the controller's raw queries from SUBS. The values are the IN-list ids, then the year,
// then (for a page) LIMIT and OFFSET, in the order the placeholders appear.
// Set Target rows (vayana_subscription_entity_new): Muscat gave Bousher 4 print and 6 digital;
// Bousher gave Unit A 3 and 2, and has a draft for Unit B (not given yet, so not counted).
const TARGET_ROWS = [
  { id: 1, setByOrg: 60, setToOrg: 70, targetPrint: 4, targetDigital: 6, campaign_status: "Active" },
  { id: 2, setByOrg: 70, setToOrg: 80, targetPrint: 3, targetDigital: 2, campaign_status: "Active" },
  { id: 3, setByOrg: 70, setToOrg: 81, targetPrint: 5, targetDigital: 5, campaign_status: "Draft" },
];

function fakeQueryRaw(sql: string, ...values: any[]) {
  if (sql.includes("FROM vayana_subscription_entity_new")) {
    return TARGET_ROWS.filter((row) => values.includes(row.setToOrg));
  }
  // One subscriber's subscriptions, rejected included (view and edit): (subscriber_id).
  if (sql.includes("WHERE subscriber_id = ?\n     ORDER BY")) {
    return SUBS.filter((row) => row.subscriber_id === values[0])
      .sort((a, b) => b.year - a.year)
      .map((row) => ({
        subscriber_id: row.subscriber_id, unit_id: row.unit_id, subscription_year: row.year, subscription_mode: row.mode,
        shop_name: null, floor_no: null, building_name: "Old Tower", street: null, area: null, province: "Muscat",
        distributor_area: null, delivery_responsibility: null, contact_person_name: null,
        registration_type: row.type, registration_method: row.method ?? "DIRECT", approval_status: row.status,
        approved_by: 1, approved_at: null, reject_reason: null, previous_year_user: "No", address_change: "No",
        currency: "OMR", amount: row.amount, cash_received: row.cash, ledger_no: null, added_by: 1,
        created_at: new Date(row.created), updated_at: null,
      }));
  }
  // A public registration being approved or rejected: (subscriber_id).
  if (sql.includes("WHERE subscriber_id = ? AND registration_method = 'PUBLIC'")) {
    const row = SUBS.find((sub) => sub.subscriber_id === values[0] && sub.method === "PUBLIC");
    return row ? [{ unit_id: row.unit_id, approval_status: row.status }] : [];
  }
  // A second pending public registration for the same mobile: (year, mobile_country, mobile).
  if (sql.includes("d.approval_status = 'PENDING' AND d.subscription_year = ?")) {
    const [, country, mobile] = values;
    return [{ total: BigInt(masters.filter((m: any) => m.status === "PENDING" && m.mobileCountry === country && m.mobile === mobile).length) }];
  }

  // Lookup by name, ledger or address: (place ids, then the search values, if any).
  if (sql.includes("AS latest")) {
    const idCount = sql.match(/IN \(([^)]*)\)/)![1]!.split(",").length;
    const places = values.slice(0, idCount);
    const term = values[idCount] ? String(values[idCount]).replace(/%/g, "").toLowerCase() : "";
    const ids = new Set(
      SUBS.filter((row) => places.includes(row.unit_id) && row.status !== "REJECTED")
        .filter((row) => !term || [row.name, (masters.find((m) => m.subscriberId === row.subscriber_id)?.ledgerNo ?? "").replace("PV100000", ""), "Old Tower", "Muscat"]
          .some((text) => text.toLowerCase().includes(term)))
        .map((row) => row.subscriber_id),
    );
    return [...ids].map((subscriber_id) => ({ subscriber_id }));
  }

  const idCount = sql.match(/IN \(([^)]*)\)/)![1]!.split(",").length;
  const ids = values.slice(0, idCount);
  const rest = values.slice(idCount);
  const [year, limit, offset] = rest;
  const approved = (row: SubRow) => row.status === "APPROVED";
  const inScope = SUBS.filter((row) => ids.includes(row.unit_id));
  const ofYear = inScope.filter((row) => row.year === year);

  // A subscriber's history (lookup and renew): their non-rejected rows, latest year first.
  if (sql.includes("WHERE subscriber_id IN")) {
    return SUBS.filter((row) => ids.includes(row.subscriber_id) && row.status !== "REJECTED")
      .sort((a, b) => b.year - a.year)
      .map((row) => ({
        subscriber_id: row.subscriber_id, unit_id: row.unit_id, subscription_year: row.year, subscription_mode: row.mode,
        shop_name: null, floor_no: null, building_name: "Old Tower", street: null, area: null, province: "Muscat",
        distributor_area: "Ruwi", delivery_responsibility: null, contact_person_name: null,
      }));
  }
  // Renew list: (ids, last year[, this year when filtered by status][, limit, offset]).
  if (sql.includes("d.subscriber_id) AS total") || sql.includes("SELECT DISTINCT d.subscriber_id")) {
    const lastYear = rest[0];
    const filtered = sql.includes(" EXISTS");
    const thisYear = filtered ? rest[1] : undefined;
    const renewed = (id: number) => SUBS.some((row) => row.subscriber_id === id && row.year === thisYear && row.status !== "REJECTED");
    const matches = inScope
      .filter((row) => row.year === lastYear && approved(row))
      .filter((row) => !filtered || (sql.includes("NOT EXISTS") ? !renewed(row.subscriber_id) : renewed(row.subscriber_id)));
    if (sql.includes("AS total")) return [{ total: BigInt(matches.length) }];
    return matches.map((row) => ({ subscriber_id: row.subscriber_id, name: row.name }));
  }
  if (sql.includes("DISTINCT subscription_year")) {
    return [...new Set(inScope.map((row) => row.year))].sort((a, b) => b - a).map((y) => ({ year: y }));
  }
  // Last year's subscribers per unit.
  if (sql.includes("COUNT(DISTINCT subscriber_id)")) {
    const counts = new Map<number, number>();
    for (const row of ofYear.filter(approved)) counts.set(row.unit_id, (counts.get(row.unit_id) ?? 0) + 1);
    return [...counts].map(([unit_id, count]) => ({ unit_id, count: BigInt(count) }));
  }
  if (sql.includes("GROUP BY")) {
    return ofYear.filter(approved).map((row) => ({
      unit_id: row.unit_id, registration_type: row.type, subscription_mode: row.mode,
      currency: "OMR", cash_received: row.cash, day: row.created.slice(0, 10), count: 1n, amount: row.amount,
    }));
  }

  // Public registrations list: (ids, status[, limit, offset]).
  if (sql.includes("d.registration_method = 'PUBLIC'")) {
    const [status, pageLimit, pageOffset] = rest;
    const matches = inScope.filter((row) => row.method === "PUBLIC" && row.status === status);
    if (sql.includes("AS total")) return [{ total: BigInt(matches.length) }];
    return matches
      .sort((a, b) => b.created.localeCompare(a.created))
      .slice(pageOffset, pageOffset + pageLimit)
      .map((row) => ({
        subscriber_id: row.subscriber_id, name: row.name, mobile_country: "968", mobile: "90000000", unit_id: row.unit_id,
        subscription_mode: row.mode, currency: "OMR", amount: row.amount, cash_received: row.cash,
        approval_status: row.status, registration_method: "PUBLIC", created_at: new Date(row.created),
        subscription_year: row.year, reject_reason: null, building_name: "Old Tower", area: null, province: "Muscat",
      }));
  }

  // Registrations list: approved new ones of the year.
  const newOfYear = ofYear.filter((row) => row.type === "NEW" && approved(row));
  if (sql.includes("COUNT(*) AS total")) return [{ total: BigInt(newOfYear.length) }];
  return [...newOfYear]
    .sort((a, b) => b.created.localeCompare(a.created))
    .slice(offset, offset! + limit!)
    .map((row) => ({
      subscriber_id: row.subscriber_id, name: row.name, mobile_country: "968", mobile: "90000000",
      unit_id: row.unit_id, subscription_mode: row.mode, currency: "OMR", amount: row.amount,
      cash_received: row.cash, approval_status: row.status, registration_method: "DIRECT", created_at: new Date(row.created),
    }));
}

type MasterRow = {
  subscriberId: number; name: string; mobile: string | null; mobileCountry: string | null; ledgerNo?: string | null;
  status?: string;
};
// Existing subscribers for the lookup: Amal is already registered for 2027 (and carries the
// placeholder ledger), Omar is outside the Division leader's branch, Laila last subscribed in 2026.
const masters: MasterRow[] = [
  { subscriberId: 1, name: "Amal", mobileCountry: "968", mobile: "95550001", ledgerNo: "PV100000" },
  { subscriberId: 2, name: "Badr", mobileCountry: "968", mobile: "95550002" },
  { subscriberId: 4, name: "Zaid", mobileCountry: "968", mobile: "95550004" },
  { subscriberId: 5, name: "Omar", mobileCountry: "968", mobile: "95550005", ledgerNo: "PV2005" },
  { subscriberId: 6, name: "Laila", mobileCountry: "968", mobile: "95550006", ledgerNo: "PV2006" },
  { subscriberId: 7, name: "Pat", mobileCountry: "968", mobile: "95550007", status: "PENDING" },
  { subscriberId: 8, name: "Rae", mobileCountry: "968", mobile: "95550008", status: "PENDING" },
  { subscriberId: 9, name: "Sam", mobileCountry: "968", mobile: "95550009", status: "PENDING" },
];
// ICF members for the membership-number lookup: Nasser is in Bousher Unit B, Faisal in Sohar.
const ICF_MEMBERS = [
  { mid: 50, membershipNo: "OM0001234", memberName: "Nasser Ali ", mobileCountry: "+968", mobile: "0091234567", whatsappNo: "96891234567", unitId: 81, active: 1 },
  { mid: 51, membershipNo: "OM0009999", memberName: "Faisal", mobileCountry: "968", mobile: "92222222", whatsappNo: "", unitId: 82, active: 1 },
];
const detailInserts: unknown[][] = [];
const updates: unknown[][] = [];
let nextSubscriberId = 1000;

const fakePrisma: any = {
  user: {
    findMany: async ({ where }: any) => people.filter((p) => where.id.in.includes(p.userId)).map((p) => ({ id: p.userId, name: `User ${p.userId}` })),
    findUnique: async ({ where }: any) => {
      const person = people.find((p) => p.userId === where.id);
      return person ? { id: person.userId, memberNo: person.memberNo, active: person.active ?? 1 } : null;
    },
  },
  committeeMember: {
    findUnique: async ({ where }: any) => {
      const person = people.find((p) => p.cmid === where.cmid);
      return person ? { cmemId: person.mid, cdesignId: person.desid, corgId: person.orgid } : null;
    },
  },
  committeeDesignations: {
    findUnique: async ({ where }: any) => ({ isCabinet: where.desid === 5 ? "Y" : "N" }),
  },
  organisationUnit: {
    findUnique: async ({ where }: any) => {
      const org = orgById.get(where.orgid);
      return org
        ? { countryCode: org.countryCode, hparent: org.hparent, hlevel: org.level === "International" ? 1 : 8 }
        : null;
    },
    // where.hparent is one id (dropdowns) or { in: [...] } (walking a leader's branch).
    findMany: async ({ where }: any) => {
      const parents: number[] = typeof where.hparent === "number" ? [where.hparent] : where.hparent.in;
      return ORGS.filter((org) => org.hparent !== null && parents.includes(org.hparent)).map((org) => ({
        orgid: org.orgid,
        hparent: org.hparent,
      }));
    },
  },
  vayanaSubscription: {
    findMany: async ({ where }: any) => PRICES.filter((price) => price.country === where.country),
  },
  pvSubscriptionMaster: {
    findFirst: async ({ where }: any) => masters.find((row: any) => row.membershipId === where.membershipId) ?? null,
    findUnique: async ({ where }: any) => masters.find((row) => row.subscriberId === where.subscriberId) ?? null,
    findMany: async ({ where }: any) =>
      masters.filter((row) =>
        where.subscriberId?.in
          ? where.subscriberId.in.includes(row.subscriberId)
          : where.ledgerNo !== undefined
            ? row.ledgerNo === where.ledgerNo
            : (row.mobile ?? "").endsWith(where.mobile.endsWith),
      ),
    update: async ({ where, data }: any) => {
      const row = masters.find((master) => master.subscriberId === where.subscriberId)!;
      Object.assign(row, data);
      return { subscriberId: row.subscriberId, ledgerNo: row.ledgerNo ?? null };
    },
    create: async ({ data }: any) => {
      const row = { subscriberId: ++nextSubscriberId, ...data };
      masters.push(row);
      return { subscriberId: row.subscriberId };
    },
  },
  membershipMaster: {
    findFirst: async ({ where }: any) => {
      const person = people.find((p) => p.memberNo === where.membershipNo);
      if (person) return { mid: person.mid };
      return ICF_MEMBERS.find((member) => member.membershipNo === where.membershipNo) ?? null;
    },
    groupBy: async ({ where }: any) =>
      where.unitId.in.filter((id: number) => MEMBERS[id]).map((id: number) => ({ unitId: id, _count: { _all: MEMBERS[id] } })),
    // Member search: in the units given, number starting with or name containing the text.
    findMany: async ({ where, take }: any) => {
      const [byNo, byName] = where.OR;
      return ICF_MEMBERS.filter(
        (member) =>
          where.unitId.in.includes(member.unitId) &&
          (member.membershipNo.startsWith(byNo.membershipNo.startsWith) ||
            member.memberName.toLowerCase().includes(byName.memberName.contains.toLowerCase())),
      )
        .sort((a, b) => a.membershipNo.localeCompare(b.membershipNo))
        .slice(0, take);
    },
  },
  // Tagged template: (strings, ...values). An INSERT is recorded; an UPDATE (approve / reject)
  // changes the public row in SUBS, whose subscriber_id is the last value.
  $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("?");
    if (sql.includes("SET unit_id")) {
      // Edit: (unit_id, subscription_id, mode, currency, amount, cash, …, subscriber_id, year).
      const [unitId, , mode, , amount, cash] = values as any[];
      const [subscriberId, year] = values.slice(-2);
      const row = SUBS.find((sub) => sub.subscriber_id === subscriberId && sub.year === year && sub.status !== "REJECTED");
      if (row) Object.assign(row, { unit_id: unitId, mode, amount, cash });
      updates.push(values);
      return row ? 1 : 0;
    }
    if (sql.includes("UPDATE pv_subscription_details")) {
      const row = SUBS.find((sub) => sub.subscriber_id === values.at(-1) && sub.method === "PUBLIC" && sub.status === "PENDING");
      if (row) row.status = sql.includes("'APPROVED'") ? "APPROVED" : "REJECTED";
      return row ? 1 : 0;
    }
    detailInserts.push(values);
    return 1;
  },
  $queryRawUnsafe: async (sql: string, ...values: number[]) => fakeQueryRaw(sql, ...values),
  $transaction: async (work: (tx: any) => Promise<unknown>) => work(fakePrisma),
};

mock.module("../../db/index.js", { exports: { prisma: fakePrisma } });

const summary = (org: Org) => ({ id: org.orgid, name: org.name, level: org.level });

// Same contract as utils/reference-data.ts: the chain from International down to the place.
mock.module("../../utils/reference-data.js", {
  exports: {
    organisationChain: async (id: number) => {
      const chain = [];
      let current = orgById.get(id);
      while (current) {
        chain.unshift(summary(current));
        current = current.hparent === null ? undefined : orgById.get(current.hparent);
      }
      return chain;
    },
    resolveOrganisationSummaries: async (ids: Iterable<number>) =>
      new Map([...ids].flatMap((id) => (orgById.has(id) ? [[id, summary(orgById.get(id)!)] as const] : []))),
  },
});

const controller = await import("./pv.controller.js");
const { validate } = await import("../../middlewares/validate.js");
const { makeReq, makeRes, runMiddleware } = await import("../../test/http.js");

/* ------------------------------------------------------------------ helpers */

type Auth = NonNullable<Request["auth"]>;
type Handler = (req: Request, res: Response) => Promise<unknown>;

// The session requireAuth would hand over for this person, acting as their committee position.
function authFor(person: Person, overrides: Partial<Auth> = {}): Auth {
  return {
    userId: String(person.userId),
    jti: "test",
    exp: 0,
    position: { cmid: person.cmid, desid: person.desid, orgid: person.orgid },
    ...overrides,
  };
}

// Runs a handler as the routes would (validated query in req.validated) and returns the response.
async function call(handler: Handler, auth: Auth, { query, body }: { query?: object; body?: object } = {}) {
  // Handlers validate req.query themselves (express-validator); req.validated is kept for older ones.
  const req = makeReq({ auth, body, query: query ? Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])) : {} });
  (req as any).validated = { query };
  const res = makeRes();
  await handler(req, res);
  return res;
}

// The 400 the route's validate middleware answers for a body, or null if it lets it through.
async function validateBody(body: unknown) {
  const { calledNext, res } = await runMiddleware(validate({ body: controller.registrationBody }), makeReq({ body }), makeRes());
  return calledNext ? null : (res.body.message as string);
}

const validBody = (overrides: Record<string, unknown> = {}) => ({
  unitId: 80,
  name: "Mariam Al-Riyami",
  buildingName: "Sun Tower",
  province: "Muscat",
  mobileCountry: "+968",
  mobile: "9167 8230",
  subscriptionMode: "Digital",
  ...overrides,
});

// Through the route's schema first, then the handler, the way a real request goes.
async function create(person: Person, body: Record<string, unknown>) {
  const parsed = controller.registrationBody.parse(body);
  return call(controller.createRegistration, authFor(person), { body: parsed });
}

/* ------------------------------------------------------------------ who is a leader */

test("context: a Division leader gets their path from the country down, and must choose a unit", async () => {
  const res = await call(controller.registrationContext, authFor(PEOPLE.divisionLeader!));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    res.body.data.path.map((place: any) => place.name),
    ["Oman", "Muscat", "Bousher"],
  );
  assert.equal(res.body.data.leader.level, "Division");
  assert.equal(res.body.data.choose_unit, true);
});

test("context: a Unit leader's unit is fixed", async () => {
  const res = await call(controller.registrationContext, authFor(PEOPLE.unitLeader!));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.choose_unit, false);
  assert.equal(res.body.data.leader.id, 80);
});

test("a non-cabinet position is refused", async () => {
  const res = await call(controller.registrationContext, authFor(PEOPLE.notCabinet!));
  assert.equal(res.statusCode, 403);
});

test("cabinet leaders at any level can add subscribers, choosing places below their own", async () => {
  const chapter = await call(controller.registrationContext, authFor(PEOPLE.chapterLeader!));
  assert.equal(chapter.statusCode, 200);
  assert.equal(chapter.body.data.leader.level, "Chapter");
  assert.equal(chapter.body.data.choose_unit, true);

  const national = await call(controller.registrationContext, authFor(PEOPLE.nationalLeader!));
  assert.equal(national.statusCode, 200);
  assert.equal(national.body.data.leader.name, "Oman");
});

test("a session with no position, or another member's position, is refused", async () => {
  const leader = PEOPLE.divisionLeader!;

  assert.equal((await call(controller.registrationContext, authFor(leader, { position: null }))).statusCode, 403);

  const borrowed = authFor(PEOPLE.unitLeader!, { position: authFor(leader).position });
  assert.equal((await call(controller.registrationContext, borrowed)).statusCode, 403);
});

test("a disabled account is refused even with a valid leader position", async () => {
  assert.equal((await call(controller.registrationContext, authFor(PEOPLE.disabledLeader!))).statusCode, 401);
});

/* ------------------------------------------------------------------ dropdowns */

test("children: a Division leader sees the units of their division", async () => {
  const res = await call(controller.childOrganisations, authFor(PEOPLE.divisionLeader!), { query: { parent_id: 70 } });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    res.body.data.places.map((place: any) => place.id),
    [80, 81],
  );
});

test("children: places above or beside the leader are refused", async () => {
  const leader = authFor(PEOPLE.divisionLeader!);

  assert.equal((await call(controller.childOrganisations, leader, { query: { parent_id: 60 } })).statusCode, 403);
  assert.equal((await call(controller.childOrganisations, leader, { query: { parent_id: 61 } })).statusCode, 403);
});

/* ------------------------------------------------------------------ price */

test("price: the open campaign of the unit's country, with each mode's price", async () => {
  const res = await call(controller.registrationPrice, authFor(PEOPLE.divisionLeader!), { query: { unit_id: 81 } });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.year, 2027);
  assert.equal(res.body.data.currency, "OMR");
  assert.deepEqual(res.body.data.prices, { Print: 5, Digital: 3.5, "Print&Digital": 6 });
});

test("price: a unit outside the leader's branch is refused", async () => {
  const res = await call(controller.registrationPrice, authFor(PEOPLE.divisionLeader!), { query: { unit_id: 82 } });
  assert.equal(res.statusCode, 403);
});

test("price: a country whose only campaign is closed gets a clear message", async () => {
  const res = await call(controller.registrationPrice, authFor(PEOPLE.saudiUnitLeader!), { query: { unit_id: 83 } });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /closed/i);
});

/* ------------------------------------------------------------------ save */

test("save: a new subscriber is saved with the server's year, currency and amount", async () => {
  const leader = PEOPLE.divisionLeader!;
  const before = detailInserts.length;

  const res = await create(leader, validBody({ email: "  mariam@example.com ", whatsapp: "", whatsappCountry: "" }));

  assert.equal(res.statusCode, 201);
  assert.deepEqual(
    { year: res.body.data.subscription_year, currency: res.body.data.currency, amount: res.body.data.amount },
    { year: 2027, currency: "OMR", amount: 3.5 },
  );

  const master = masters.find((row) => row.subscriberId === res.body.data.subscriber_id) as any;
  assert.equal(master.mobileCountry, "968");
  assert.equal(master.mobile, "91678230");
  assert.equal(master.email, "mariam@example.com");
  assert.equal(master.whatsapp, null);
  assert.equal(master.status, "ACTIVE");

  assert.equal(detailInserts.length, before + 1);
  const values = detailInserts.at(-1)!;
  // subscriber_id, subscription_id (price row), unit_id, registration_type, approved_by, ..., added_by
  assert.equal(values[0], res.body.data.subscriber_id);
  assert.equal(values[1], 41);
  assert.equal(values[2], 80);
  assert.equal(values[3], "NEW");
  assert.equal(values[4], leader.userId);
  assert.equal(values.at(-2), leader.userId);
  assert.ok(values.includes("Digital") && values.includes("OMR") && values.includes(3.5));
});

test("save: the same person again (other spacing and case) is sent to the existing-subscriber search", async () => {
  const leader = PEOPLE.unitLeader!;
  await create(leader, validBody({ name: "Salim Nasser", mobile: "92223333" }));
  const before = detailInserts.length;

  const res = await create(leader, validBody({ name: "  salim  NASSER", mobile: "0 9222 3333" }));

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /already registered/i);
  assert.equal(detailInserts.length, before);
});

test("save: a unit outside the leader's branch, or a place that is not a unit, is refused", async () => {
  const leader = PEOPLE.divisionLeader!;

  assert.equal((await create(leader, validBody({ unitId: 82, mobile: "93334444" }))).statusCode, 403);
  assert.equal((await create(leader, validBody({ unitId: 70, mobile: "93334445" }))).statusCode, 400);
});

test("save: nothing is saved while the country's campaign is closed", async () => {
  const before = detailInserts.length;
  const res = await create(PEOPLE.saudiUnitLeader!, validBody({ unitId: 83, mobileCountry: "966", mobile: "501234567" }));

  assert.equal(res.statusCode, 400);
  assert.equal(detailInserts.length, before);
});

/* ------------------------------------------------------------------ request validation */

test("validation: the client cannot send the amount, currency or year", async () => {
  assert.ok(await validateBody(validBody({ amount: 0 })));
  assert.ok(await validateBody(validBody({ currency: "USD" })));
  assert.ok(await validateBody(validBody({ subscriptionYear: 2020 })));
});

test("validation: required fields and their messages", async () => {
  assert.equal(await validateBody(validBody({ buildingName: " " })), "Please enter the building name.");
  assert.equal(await validateBody(validBody({ province: undefined })), "Please enter the state/province/emirate.");
  assert.equal(await validateBody(validBody({ mobile: "12" })), "Please enter a valid mobile number.");
  assert.equal(await validateBody(validBody({ subscriptionMode: "Weekly" })), "Please choose a subscription mode.");
  assert.equal(await validateBody(validBody({ email: "not-an-email" })), "Please enter a valid email address.");
  assert.equal(await validateBody(validBody()), null);
});

test("validation: delivery responsibility only with Print, and WhatsApp needs its country code", async () => {
  assert.match(
    (await validateBody(validBody({ subscriptionMode: "Digital", deliveryResponsibility: "Rashid" })))!,
    /only for subscriptions that include Print/,
  );
  assert.equal(await validateBody(validBody({ subscriptionMode: "Print", deliveryResponsibility: "Rashid" })), null);
  assert.equal(await validateBody(validBody({ whatsapp: "91678230" })), "Please choose the WhatsApp country code.");
});

/* ------------------------------------------------------------------ analytics */

test("analytics: work progress for the leader's place, approved subscriptions only", async () => {
  const res = await call(controller.registrationAnalytics, authFor(PEOPLE.divisionLeader!), { query: {} });

  assert.equal(res.statusCode, 200);
  const data = res.body.data;
  assert.equal(data.year, 2027);
  assert.deepEqual(data.years, [2027, 2026]);
  assert.equal(data.scope.place.name, "Bousher");
  // Pending public registrations and the rejected one do not count; Sohar (82) is outside.
  // The target is Set Target's print + digital; Print&Digital counts as print.
  assert.deepEqual(data.totals, {
    subscriptions: 3, new: 2, renewals: 1, renewable: 1, paid: 2, print: 2, digital: 1,
    membership: 16, total_units: 2, target: 10, target_print: 4, target_digital: 6, progress: 3 / 10,
  });
  assert.deepEqual(data.by_mode, { Print: 1, Digital: 1, "Print&Digital": 1 });
  assert.deepEqual(data.by_day, [
    { day: "2027-01-03", new: 1, renewals: 0 },
    { day: "2027-01-04", new: 0, renewals: 1 },
    { day: "2027-01-05", new: 1, renewals: 0 },
  ]);
  assert.deepEqual(data.amounts, [{
    currency: "OMR", total: 14.5, received: 9.5,
    by_day: [
      { day: "2027-01-03", total: 3.5, received: 3.5 },
      { day: "2027-01-04", total: 6, received: 6 },
      { day: "2027-01-05", total: 5, received: 0 },
    ],
  }]);
  // Unit B's target is still a draft, so it has none yet.
  assert.deepEqual(
    data.places.map((place: any) => [
      place.name, place.subscriptions, place.print, place.digital, place.paid,
      place.target, place.target_print, place.target_digital, place.progress, place.renewable,
    ]),
    [
      ["Bousher Unit A", 1, 0, 1, 1, 5, 3, 2, 1 / 5, 1],
      ["Bousher Unit B", 2, 2, 0, 1, 0, 0, 0, null, 0],
    ],
  );
});

test("analytics: a Region leader's places are the divisions below the region, with units summed up", async () => {
  const res = await call(controller.registrationAnalytics, authFor(PEOPLE.regionLeader!), { query: { year: 2027 } });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    res.body.data.places.map((place: any) => [place.name, place.subscriptions, place.total_units, place.membership]),
    [["Bousher", 3, 2, 16]],
  );
});

test("analytics: drill down to a place below, never beside or above", async () => {
  const leader = authFor(PEOPLE.regionLeader!);

  const unit = await call(controller.registrationAnalytics, leader, { query: { org_id: 81 } });
  assert.equal(unit.statusCode, 200);
  assert.equal(unit.body.data.scope.place.name, "Bousher Unit B");
  assert.equal(unit.body.data.scope.top_id, 60);
  assert.deepEqual(unit.body.data.places, []);
  assert.equal(unit.body.data.totals.subscriptions, 2);

  assert.equal((await call(controller.registrationAnalytics, leader, { query: { org_id: 61 } })).statusCode, 403);
  assert.equal((await call(controller.registrationAnalytics, leader, { query: { org_id: 2 } })).statusCode, 403);
});

test("analytics: a branch with no subscriptions has no year, zero totals and no progress", async () => {
  const res = await call(controller.registrationAnalytics, authFor(PEOPLE.saudiUnitLeader!), { query: {} });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.year, null);
  assert.equal(res.body.data.totals.subscriptions, 0);
  assert.equal(res.body.data.totals.progress, null);
});

/* ------------------------------------------------------------------ registrations list */

test("list: approved new registrations in the leader's branch, newest first, one page at a time", async () => {
  const leader = authFor(PEOPLE.divisionLeader!);

  const first = await call(controller.listRegistrations, leader, { query: { page: 1, page_size: 1 } });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.data.year, 2027);
  assert.deepEqual(first.body.data.years, [2027, 2026]);
  assert.equal(first.body.data.total, 2);
  assert.deepEqual(first.body.data.items.map((row: any) => row.name), ["Badr"]);
  assert.equal(first.body.data.items[0].unit.name, "Bousher Unit B");

  const second = await call(controller.listRegistrations, leader, { query: { page: 2, page_size: 1 } });
  assert.deepEqual(second.body.data.items.map((row: any) => row.name), ["Amal"]);

  const older = await call(controller.listRegistrations, leader, { query: { year: 2026, page: 1, page_size: 10 } });
  assert.deepEqual(older.body.data.items.map((row: any) => row.name), ["Laila"]);
});

test("list and analytics are for leaders only", async () => {
  const auth = authFor(PEOPLE.notCabinet!);

  assert.equal((await call(controller.listRegistrations, auth, { query: { page: 1, page_size: 10 } })).statusCode, 403);
  assert.equal((await call(controller.registrationAnalytics, auth, { query: {} })).statusCode, 403);
});

/* ------------------------------------------------------------------ existing subscriber lookup and renew */

const lookup = (person: Person, q: string) => call(controller.lookupSubscribers, authFor(person), { query: { q } });
const lookupNames = async (person: Person, q: string) =>
  (await lookup(person, q)).body.data.subscribers.map((row: any) => row.name);

test("lookup: by subscriber number, ledger number or mobile (with or without the country code)", async () => {
  const leader = PEOPLE.divisionLeader!;

  assert.deepEqual(await lookupNames(leader, "6"), ["Laila"]);
  assert.deepEqual(await lookupNames(leader, "PV2006"), ["Laila"]);
  assert.deepEqual(await lookupNames(leader, "9555 0006"), ["Laila"]);
  assert.deepEqual(await lookupNames(leader, "+968 95550006"), ["Laila"]);
  assert.deepEqual(await lookupNames(leader, "0000000"), []);
});

test("lookup: returns last year's subscription to fill the form, and whether this year is already registered", async () => {
  const leader = PEOPLE.divisionLeader!;

  const laila = (await lookup(leader, "6")).body.data;
  assert.equal(laila.year, 2027);
  assert.equal(laila.subscribers[0].already_registered_this_year, false);
  assert.equal(laila.subscribers[0].previous.year, 2026);
  assert.equal(laila.subscribers[0].previous.building_name, "Old Tower");
  assert.equal(laila.subscribers[0].previous.unit.name, "Bousher Unit A");

  const amal = (await lookup(leader, "1")).body.data.subscribers[0];
  assert.equal(amal.already_registered_this_year, true);
});

test("lookup: the placeholder ledger and subscribers outside the leader's branch are not returned", async () => {
  assert.deepEqual(await lookupNames(PEOPLE.divisionLeader!, "PV100000"), []);
  assert.deepEqual(await lookupNames(PEOPLE.divisionLeader!, "5"), []);
  assert.deepEqual(await lookupNames(PEOPLE.regionLeader!, "5"), []);
});

test("lookup: by name, and everyone in a chosen place without a search", async () => {
  const leader = PEOPLE.divisionLeader!;
  assert.deepEqual(await lookupNames(leader, "lai"), ["Laila"]);

  const inUnit = await call(controller.lookupSubscribers, authFor(leader), { query: { org_id: 81 } });
  assert.equal(inUnit.statusCode, 200);
  // Hind subscribes in Unit B too, but has no subscriber record in this fixture.
  assert.deepEqual(inUnit.body.data.subscribers.map((row: any) => row.name).sort(), ["Badr", "Pat"]);
  assert.equal(inUnit.body.data.more, false);

  assert.equal((await call(controller.lookupSubscribers, authFor(leader), { query: {} })).statusCode, 400);
  assert.equal((await call(controller.lookupSubscribers, authFor(leader), { query: { q: "a" } })).statusCode, 400);
  assert.equal((await call(controller.lookupSubscribers, authFor(leader), { query: { org_id: 61 } })).statusCode, 403);
});

test("member search: by number or name, only inside the leader's branch", async () => {
  const leader = PEOPLE.divisionLeader!;
  const search = (q: string) => call(controller.searchMembers, authFor(leader), { query: { q } });

  const byNumber = await search("om000");
  assert.equal(byNumber.statusCode, 200, byNumber.body.message);
  // Faisal (OM0009999) is in Sohar (82), outside Bousher.
  assert.deepEqual(byNumber.body.data, {
    members: [{ membership_no: "OM0001234", name: "Nasser Ali", active: true, unit: "Bousher Unit B" }],
    more: false,
  });
  assert.deepEqual((await search("nass")).body.data.members.map((m: any) => m.membership_no), ["OM0001234"]);
  assert.deepEqual((await search("faisal")).body.data.members, []);
  assert.equal((await search("o")).statusCode, 400);
});

test("member lookup: an ICF member in the branch fills the form; others are refused", async () => {
  const leader = PEOPLE.divisionLeader!;
  const find = (no: string) => call(controller.lookupMember, authFor(leader), { query: { membership_no: no } });

  const res = await find("om0001234");
  assert.equal(res.statusCode, 200, res.body.message);
  const data = res.body.data;
  assert.deepEqual(
    [data.membership_no, data.name, data.mobile_country, data.mobile, data.whatsapp, data.unit.name, data.existing_subscriber],
    ["OM0001234", "Nasser Ali", "968", "91234567", "91234567", "Bousher Unit B", null],
  );
  assert.deepEqual(data.path.map((place: any) => place.id), [81]);

  assert.equal((await find("OM0009999")).statusCode, 403);
  assert.equal((await find("OM0000000")).statusCode, 404);
  assert.equal((await find("12345")).statusCode, 400);
});

test("create: an ICF member's number is saved; unknown numbers and members outside the branch are refused", async () => {
  const leader = PEOPLE.divisionLeader!;
  const refused = await create(leader, validBody({ mobile: "95551111", isIcfMember: "Yes", membershipId: "OM0000000" }));
  assert.equal(refused.statusCode, 400);
  assert.equal(refused.body.message, "No ICF member has that membership number.");

  // Faisal is a member in Sohar, outside the Division leader's branch.
  const outside = await create(leader, validBody({ mobile: "95552222", isIcfMember: "Yes", membershipId: "OM0009999" }));
  assert.equal(outside.statusCode, 403);
  assert.equal(outside.body.message, "That member belongs to a unit outside your position.");

  const res = await create(leader, validBody({ name: "Nasser Ali", mobile: "91234567", isIcfMember: "Yes", membershipId: "om0001234" }));
  assert.equal(res.statusCode, 201, res.body.message);
  const saved: any = masters.find((row) => row.subscriberId === res.body.data.subscriber_id);
  assert.deepEqual([saved.isIcfMember, saved.membershipId], ["Yes", "OM0001234"]);

  // Already a subscriber now: the member lookup says so.
  const again = await call(controller.lookupMember, authFor(leader), { query: { membership_no: "OM0001234" } });
  assert.equal(again.body.data.existing_subscriber.subscriber_id, res.body.data.subscriber_id);
});

test("validation: Yes to ICF member needs a membership number", async () => {
  assert.equal(
    await validateBody(validBody({ isIcfMember: "Yes", membershipId: "OM12" })),
    "Please enter a valid membership number, e.g. OM0001234.",
  );
  assert.equal(await validateBody(validBody({ isIcfMember: "No" })), null);
});

test("renew: saved as RENEW for the open year, with the master's contact details updated", async () => {
  const leader = PEOPLE.divisionLeader!;

  const res = await create(
    leader,
    validBody({ subscriberId: 6, name: "Laila K", mobile: "95550006", buildingName: "Old Tower", email: "laila@example.com" }),
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.subscriber_id, 6);
  assert.equal(res.body.data.registration_type, "RENEW");
  assert.equal(res.body.data.subscription_year, 2027);

  const values = detailInserts.at(-1)!;
  assert.equal(values[0], 6);
  assert.equal(values[3], "RENEW");
  assert.equal(values[6], "Yes"); // previous_year_user
  assert.equal(values[18], "No"); // address_change: same building and province as last year
  assert.equal(values[22], "PV2006"); // ledger_no kept from the master

  const master = masters.find((row) => row.subscriberId === 6) as any;
  assert.equal(master.name, "Laila K");
  assert.equal(master.email, "laila@example.com");
});

test("renew: a changed address is flagged", async () => {
  const res = await create(PEOPLE.divisionLeader!, validBody({ subscriberId: 6, mobile: "95550006", buildingName: "New Tower" }));

  assert.equal(res.statusCode, 201);
  assert.equal(detailInserts.at(-1)![18], "Yes");
});

test("renew: refused when already registered this year, outside the branch, or unknown", async () => {
  const leader = PEOPLE.divisionLeader!;
  const before = detailInserts.length;

  const already = await create(leader, validBody({ subscriberId: 1, mobile: "95550001" }));
  assert.equal(already.statusCode, 400);
  assert.match(already.body.message, /already registered for 2027/);

  assert.equal((await create(leader, validBody({ subscriberId: 5, mobile: "95550005" }))).statusCode, 403);
  assert.equal((await create(leader, validBody({ subscriberId: 999, mobile: "95550999" }))).statusCode, 400);
  assert.equal(detailInserts.length, before);
});

/* ------------------------------------------------------------------ renew list */

const renewals = (person: Person, query: Record<string, unknown> = {}) =>
  call(controller.listRenewals, authFor(person), { query: controller.renewalsQuery.parse(query) });

test("renew list: last year's subscribers in the branch, with the dropdown path to their unit", async () => {
  const division = await renewals(PEOPLE.divisionLeader!);
  assert.equal(division.statusCode, 200);
  assert.equal(division.body.data.year, 2027);
  // Subscriber 6 (Laila); an earlier test renamed her, so match on the id.
  assert.deepEqual(division.body.data.items.map((row: any) => row.subscriber_id), [6]);
  const laila = division.body.data.items[0];
  assert.equal(laila.already_registered_this_year, false);
  assert.deepEqual(laila.previous.path.map((place: any) => place.name), ["Bousher Unit A"]);

  // A Region leader chooses the division first, then the unit.
  const region = await renewals(PEOPLE.regionLeader!);
  assert.deepEqual(region.body.data.items[0].previous.path.map((place: any) => place.name), ["Bousher", "Bousher Unit A"]);

  // A Unit leader's unit is fixed: nothing to choose.
  const unit = await renewals(PEOPLE.unitLeader!);
  assert.deepEqual(unit.body.data.items[0].previous.path, []);
});

test("renew list: filter by renewed or still to renew", async () => {
  assert.deepEqual(
    (await renewals(PEOPLE.divisionLeader!, { status: "renew" })).body.data.items.map((row: any) => row.subscriber_id),
    [6],
  );
  assert.deepEqual((await renewals(PEOPLE.divisionLeader!, { status: "renewed" })).body.data.items, []);
});

/* ------------------------------------------------------------------ public registrations: leader side */

const publicList = (person: Person, status = "PENDING") =>
  call(controller.listPublicRegistrations, authFor(person), { query: { status, page: 1, page_size: 10 } });

async function decide(person: Person, subscriberId: number, action: "approve" | "reject", reason?: string) {
  const req = makeReq({ auth: authFor(person), body: reason === undefined ? undefined : { reason } });
  (req as any).validated = { params: { subscriber_id: subscriberId } };
  const res = makeRes();
  await (action === "approve" ? controller.approvePublicRegistration : controller.rejectPublicRegistration)(req, res);
  return res;
}

test("public list: pending registrations in the leader's branch only, newest first", async () => {
  const res = await publicList(PEOPLE.divisionLeader!);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.items.map((row: any) => row.name), ["Rae", "Pat"]);
});

test("approve: counts from then on and leaves the pending list; deciding again is refused", async () => {
  const leader = PEOPLE.divisionLeader!;

  const res = await decide(leader, 7, "approve");
  assert.equal(res.statusCode, 200);
  assert.equal(SUBS.find((row) => row.subscriber_id === 7)!.status, "APPROVED");
  assert.equal(masters.find((row) => row.subscriberId === 7)!.status, "ACTIVE");
  assert.deepEqual((await publicList(leader)).body.data.items.map((row: any) => row.name), ["Rae"]);

  const again = await decide(leader, 7, "reject", "duplicate");
  assert.equal(again.statusCode, 400);
});

test("reject: needs a reason, and only for registrations inside the leader's branch", async () => {
  const leader = PEOPLE.divisionLeader!;

  const { calledNext } = await runMiddleware(validate({ body: controller.rejectBody }), makeReq({ body: { reason: " " } }), makeRes());
  assert.equal(calledNext, false);

  assert.equal((await decide(leader, 9, "reject", "not ours")).statusCode, 403);
  assert.equal((await decide(leader, 8, "reject", "Already a subscriber")).statusCode, 200);
  assert.equal(SUBS.find((row) => row.subscriber_id === 8)!.status, "REJECTED");
  assert.equal((await decide(PEOPLE.notCabinet!, 9, "approve")).statusCode, 403);
});

/* ------------------------------------------------------------------ public link (no login) */

async function publicCall(handler: Handler, params: object, query?: object) {
  const req = makeReq({});
  (req as any).validated = { params, query };
  const res = makeRes();
  await handler(req, res);
  return res;
}

const publicBody = (overrides: Record<string, unknown> = {}) =>
  controller.publicRegistrationBody.parse({ rootId: 70, ...validBody({ unitId: 81, mobile: "96660001" }), ...overrides });

async function createPublic(body: object) {
  const req = makeReq({ body });
  const res = makeRes();
  await controller.createPublicRegistration(req, res);
  return res;
}

test("public link: a Division link fixes the path to the division; the visitor chooses the unit", async () => {
  const res = await publicCall(controller.publicContext, { root_id: 70 });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.path.map((place: any) => place.name), ["Oman", "Muscat", "Bousher"]);
  assert.equal(res.body.data.choose_unit, true);

  assert.equal((await publicCall(controller.publicContext, { root_id: 80 })).body.data.choose_unit, false);
  // Links are only for leader places (Region, Division, Unit).
  assert.equal((await publicCall(controller.publicContext, { root_id: 2 })).statusCode, 404);
});

test("public link: dropdowns and price stay inside the link's place", async () => {
  const children = await publicCall(controller.publicChildren, { root_id: 60 }, { parent_id: 60 });
  assert.deepEqual(children.body.data.places.map((place: any) => place.name), ["Bousher"]);

  assert.equal((await publicCall(controller.publicChildren, { root_id: 70 }, { parent_id: 61 })).statusCode, 403);
  assert.equal((await publicCall(controller.publicPrice, { root_id: 70 }, { unit_id: 82 })).statusCode, 403);
  assert.equal((await publicCall(controller.publicPrice, { root_id: 70 }, { unit_id: 81 })).body.data.currency, "OMR");
});

test("public save: always a pending new registration with no cash; a second one for the same mobile is refused", async () => {
  const before = detailInserts.length;

  const res = await createPublic(publicBody());
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.approval_status, "PENDING");
  const master = masters.find((row) => row.subscriberId === res.body.data.subscriber_id)!;
  assert.equal(master.status, "PENDING");
  assert.equal(detailInserts.length, before + 1);
  assert.deepEqual(detailInserts.at(-1)!.slice(0, 3), [res.body.data.subscriber_id, 41, 81]);

  const again = await createPublic(publicBody({ name: "Someone Else" }));
  assert.equal(again.statusCode, 400);
  assert.match(again.body.message, /already waiting for approval/);
});

test("public save: the unit must be inside the link, and cash or a subscriber id cannot be sent", async () => {
  assert.equal((await createPublic(publicBody({ unitId: 82, mobile: "96660002" }))).statusCode, 403);
  assert.throws(() => publicBody({ cashReceived: "Y" }));
  assert.throws(() => publicBody({ subscriberId: 6 }));
});

/* ------------------------------------------------------------------ subscriber view and edit */

async function view(person: Person, subscriberId: number, year?: number) {
  const req = makeReq({ auth: authFor(person) });
  (req as any).validated = { params: { subscriber_id: subscriberId }, query: year === undefined ? {} : { year } };
  const res = makeRes();
  await controller.subscriberDetails(req, res);
  return res;
}

async function edit(person: Person, subscriberId: number, year: number, body: Record<string, unknown>) {
  const req = makeReq({ auth: authFor(person), body: controller.subscriptionUpdateBody.parse(body) });
  (req as any).validated = { params: { subscriber_id: subscriberId, year } };
  const res = makeRes();
  await controller.updateSubscription(req, res);
  return res;
}

test("view: the latest subscription in full, with history and who approved it", async () => {
  const res = await view(PEOPLE.divisionLeader!, 2);

  assert.equal(res.statusCode, 200);
  const data = res.body.data;
  assert.equal(data.subscriber.subscriber_id, 2);
  assert.equal(data.subscription.year, 2027);
  assert.equal(data.subscription.unit.name, "Bousher Unit B");
  assert.deepEqual(data.subscription.path.map((place: any) => place.name), ["Oman", "Muscat", "Bousher", "Bousher Unit B"]);
  assert.deepEqual(data.subscription.form_path.map((place: any) => place.name), ["Bousher Unit B"]);
  assert.equal(data.subscription.approved_by, "User 1");
  assert.equal(data.allowed_actions.edit, true);
  assert.deepEqual(data.history.map((row: any) => row.year), [2027]);
});

test("view: last year's subscription is view-only; a rejected one cannot be edited", async () => {
  const older = await view(PEOPLE.divisionLeader!, 6, 2026);
  assert.equal(older.statusCode, 200);
  assert.equal(older.body.data.allowed_actions.edit, false);
  assert.match(older.body.data.edit_blocked_reason, /Only this year's/);

  const rejected = await view(PEOPLE.divisionLeader!, 4);
  assert.equal(rejected.body.data.allowed_actions.edit, false);
});

test("view: outside the leader's branch is refused; unknown is 404", async () => {
  assert.equal((await view(PEOPLE.divisionLeader!, 5)).statusCode, 403);
  assert.equal((await view(PEOPLE.divisionLeader!, 9999)).statusCode, 404);
  assert.equal((await view(PEOPLE.divisionLeader!, 2, 2020)).statusCode, 404);
});

test("edit: this year's subscription moves unit and mode, with the amount worked out again", async () => {
  const res = await edit(PEOPLE.divisionLeader!, 2, 2027, validBody({ unitId: 80, name: "Badr", mobile: "95550002", subscriptionMode: "Print&Digital", cashReceived: "Y" }));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.amount, 6);
  const row = SUBS.find((sub) => sub.subscriber_id === 2)!;
  assert.deepEqual([row.unit_id, row.mode, row.amount, row.cash], [80, "Print&Digital", 6, "Y"]);
});

test("edit: refused for earlier years, rejected rows, units outside the branch and other branches", async () => {
  const leader = PEOPLE.divisionLeader!;
  const before = updates.length;

  assert.equal((await edit(leader, 6, 2026, validBody({ mobile: "95550006" }))).statusCode, 400);
  assert.match((await edit(leader, 4, 2027, validBody({ mobile: "95550004" }))).body.message, /rejected/);
  assert.equal((await edit(leader, 1, 2027, validBody({ unitId: 82, mobile: "95550001" }))).statusCode, 403);
  assert.equal((await edit(leader, 5, 2027, validBody({ unitId: 80, mobile: "95550005" }))).statusCode, 403);
  assert.equal(updates.length, before);
});

test("edit: type, method, status, year and amount cannot be sent", () => {
  for (const extra of [{ amount: 1 }, { subscriptionYear: 2026 }, { approvalStatus: "APPROVED" }, { subscriberId: 3 }]) {
    assert.throws(() => controller.subscriptionUpdateBody.parse(validBody(extra)));
  }
});

test("price: a unit with a blank country code uses the country of the places above it", async () => {
  const res = await call(controller.registrationPrice, authFor(PEOPLE.nationalLeader!), { query: { unit_id: 84 } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.currency, "OMR");
});

test("price: a closed campaign names the country and years", async () => {
  const res = await call(controller.registrationPrice, authFor(PEOPLE.saudiUnitLeader!), { query: { unit_id: 83 } });
  assert.match(res.body.message, /SA/);
});
