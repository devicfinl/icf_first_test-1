import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

process.env.JWT_SECRET ??= "test-secret";

/* ------------------------------------------------------------------ fixture */

//   ICF International (1)
//   ├── Oman (2, National)
//   │   ├── Muscat (60, Region) ── Bousher (70, Division) ── Unit A (80), Unit B (81)
//   │   └── Sohar (61, Region) ── Sohar Unit (82)
//   └── Saudi (3, National)
type Org = { orgid: number; name: string; level: string; hparent: number | null; countryCode: string };
const ORGS: Org[] = [
  { orgid: 1, name: "ICF International", level: "International", hparent: null, countryCode: "" },
  { orgid: 2, name: "Oman", level: "National", hparent: 1, countryCode: "OM" },
  { orgid: 60, name: "Muscat", level: "Region", hparent: 2, countryCode: "OM" },
  { orgid: 70, name: "Bousher", level: "Division", hparent: 60, countryCode: "OM" },
  { orgid: 80, name: "Unit A", level: "Unit", hparent: 70, countryCode: "OM" },
  { orgid: 81, name: "Unit B", level: "Unit", hparent: 70, countryCode: "OM" },
  { orgid: 61, name: "Sohar", level: "Region", hparent: 2, countryCode: "OM" },
  { orgid: 82, name: "Sohar Unit", level: "Unit", hparent: 61, countryCode: "OM" },
  { orgid: 3, name: "Saudi", level: "National", hparent: 1, countryCode: "SA" },
];
const orgById = new Map(ORGS.map((org) => [org.orgid, org]));

type Person = { userId: number; memberNo: string; mid: number; cmid: number; orgid: number };
const PEOPLE = {
  international: { userId: 1, memberNo: "IN0000001", mid: 1, cmid: 100, orgid: 1 },
  national: { userId: 2, memberNo: "OM0000002", mid: 2, cmid: 101, orgid: 2 },
  muscat: { userId: 3, memberNo: "OM0000003", mid: 3, cmid: 102, orgid: 60 },
  sohar: { userId: 4, memberNo: "OM0000004", mid: 4, cmid: 103, orgid: 61 },
  unit: { userId: 5, memberNo: "OM0000005", mid: 5, cmid: 104, orgid: 80 },
} satisfies Record<string, Person>;
const people: Person[] = Object.values(PEOPLE);

// Open campaigns: Oman 2027 (2026 closed), Saudi 2026.
const PRICES = [
  { id: 40, country: "OM", currency: "OMR", year: "2026", campaignStatus: "Closed", amount: 5, priceDigital: 3.5, pricePrintDigital: 5 },
  { id: 41, country: "OM", currency: "OMR", year: "2027", campaignStatus: "Open", amount: 5, priceDigital: 3.5, pricePrintDigital: 6 },
  { id: 42, country: "SA", currency: "SAR", year: "2026", campaignStatus: "Open", amount: 40, priceDigital: 40, pricePrintDigital: 40 },
];

// Subscriptions: only approved ones of the open year count.
const SUBS = [
  { unit_id: 80, year: 2027, mode: "Print", status: "APPROVED" },
  { unit_id: 81, year: 2027, mode: "Digital", status: "APPROVED" },
  { unit_id: 81, year: 2027, mode: "Print&Digital", status: "APPROVED" },
  { unit_id: 82, year: 2027, mode: "Digital", status: "PENDING" },
  { unit_id: 80, year: 2026, mode: "Print", status: "APPROVED" },
];

type Target = {
  id: number; setByOrg: number; setByLevel: string; setByName: string; setToOrg: number; setToLevel: string;
  setToName: string; targetYear: number; targetPrint: number; targetDigital: number; campaign_status: string;
};
const target = (id: number, by: number, to: number, print: number, digital: number, status: string, year = 2027): Target => ({
  id, setByOrg: by, setByLevel: orgById.get(by)!.level, setByName: orgById.get(by)!.name, setToOrg: to,
  setToLevel: orgById.get(to)!.level, setToName: orgById.get(to)!.name, targetYear: year, targetPrint: print,
  targetDigital: digital, campaign_status: status,
});
// The 2027 campaign: International -> Oman 100/150; Oman -> Muscat 40/60 and a Sohar draft;
// Muscat -> Bousher 50/10, more print than Muscat has; an old row of another status for Muscat
// that must be ignored. The 2026 campaign, closed: International -> Oman 70/80.
const initialTargets = () => [
  target(0, 1, 2, 100, 150, "Active"),
  target(1, 2, 60, 40, 60, "Active"),
  target(2, 2, 61, 10, 10, "Draft"),
  target(3, 60, 70, 50, 10, "Active"),
  target(4, 2, 60, 999, 999, "Cancelled"),
  target(5, 1, 2, 70, 80, "Closed", 2026),
];
let TARGETS: Target[] = initialTargets();
beforeEach(() => {
  TARGETS = initialTargets();
});

function fakeQueryRaw(sql: string, ...values: any[]) {
  const inUse = (row: Target) => ["Active", "Draft", "Closed"].includes(row.campaign_status);
  if (sql.includes("SELECT targetYear AS year")) {
    const years = [...new Set(TARGETS.filter(inUse).map((row) => row.targetYear))].sort((a, b) => b - a);
    return years.map((year) => ({
      year,
      closed: TARGETS.some((row) => row.targetYear === year && row.campaign_status === "Closed") ? 1 : 0,
    }));
  }
  if (sql.includes("FROM vayana_subscription_entity_new")) {
    // The place ids, then the year.
    const column = sql.includes("WHERE setToOrg IN") ? "setToOrg" : "setByOrg";
    const ids = values.slice(0, -1);
    const year = values.at(-1);
    return TARGETS.filter((row) => ids.includes(row[column]) && row.targetYear === year && inUse(row))
      .sort((a, b) => b.id - a.id)
      .map(({ id, setByOrg, setToOrg, targetPrint, targetDigital, campaign_status }) => ({
        id, setByOrg, setToOrg, targetPrint, targetDigital, campaign_status,
      }));
  }
  if (sql.includes("FROM pv_subscription_details")) {
    const ids = values.slice(0, -1);
    const year = values.at(-1);
    const counts = new Map<string, number>();
    for (const sub of SUBS.filter((s) => ids.includes(s.unit_id) && s.year === year && s.status === "APPROVED")) {
      const key = `${sub.unit_id}|${sub.mode}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts].map(([key, count]) => {
      const [unit, mode] = key.split("|");
      return { unit_id: Number(unit), subscription_mode: mode, count: BigInt(count) };
    });
  }
  throw new Error(`Unexpected query: ${sql}`);
}

function fakeExecuteRaw(sql: string, ...values: any[]) {
  if (sql.startsWith("UPDATE")) {
    const [setByOrg, setByLevel, setByName, setToLevel, setToName, targetPrint, targetDigital, status, id] = values;
    const row = TARGETS.find((t) => t.id === id)!;
    Object.assign(row, { setByOrg, setByLevel, setByName, setToLevel, setToName, targetPrint, targetDigital, campaign_status: status });
    return 1;
  }
  const [setByOrg, setByLevel, setByName, setToOrg, setToLevel, setToName, targetYear, targetPrint, targetDigital, status] = values;
  TARGETS.push({
    id: Math.max(-1, ...TARGETS.map((t) => t.id)) + 1,
    setByOrg, setByLevel, setByName, setToOrg, setToLevel, setToName, targetYear, targetPrint, targetDigital,
    campaign_status: status,
  });
  return 1;
}

const fakePrisma: any = {
  user: {
    findUnique: async ({ where }: any) => {
      const person = people.find((p) => p.userId === where.id);
      return person ? { id: person.userId, memberNo: person.memberNo, active: 1 } : null;
    },
  },
  membershipMaster: {
    findFirst: async ({ where }: any) => {
      const person = people.find((p) => p.memberNo === where.membershipNo);
      return person ? { mid: person.mid } : null;
    },
  },
  committeeMember: {
    findUnique: async ({ where }: any) => {
      const person = people.find((p) => p.cmid === where.cmid);
      return person ? { cmemId: person.mid, cdesignId: 5, corgId: person.orgid } : null;
    },
  },
  committeeDesignations: { findUnique: async () => ({ isCabinet: "Y" }) },
  organisationUnit: {
    findUnique: async ({ where }: any) => {
      const org = orgById.get(where.orgid);
      return org ? { countryCode: org.countryCode, hparent: org.hparent, hlevel: org.level === "International" ? 1 : 8 } : null;
    },
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
  $queryRawUnsafe: async (sql: string, ...values: any[]) => fakeQueryRaw(sql, ...values),
  $executeRawUnsafe: async (sql: string, ...values: any[]) => fakeExecuteRaw(sql, ...values),
  // All or nothing, like the database: a failed save leaves the rows as they were.
  $transaction: async (work: (tx: any) => Promise<unknown>) => {
    const before = structuredClone(TARGETS);
    try {
      return await work(fakePrisma);
    } catch (error) {
      TARGETS = before;
      throw error;
    }
  },
};

mock.module("../../db/index.js", { exports: { prisma: fakePrisma } });

const summary = (org: Org) => ({ id: org.orgid, name: org.name, level: org.level });
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

const controller = await import("./pv-targets.controller.js");
const { makeReq, makeRes } = await import("../../test/http.js");

/* ------------------------------------------------------------------ helpers */

type Handler = (req: Request, res: Response) => Promise<unknown>;

async function call(handler: Handler, person: Person, { query, body }: { query?: object; body?: object } = {}) {
  const auth = {
    userId: String(person.userId),
    jti: "test",
    exp: 0,
    position: { cmid: person.cmid, desid: 5, orgid: person.orgid },
  };
  const req = makeReq({
    auth,
    body,
    query: query ? Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])) : {},
  });
  const res = makeRes();
  await handler(req, res);
  return res;
}

const view = (person: Person, orgId?: number, year?: number) =>
  call(controller.targetsView, person, {
    query: { ...(orgId === undefined ? {} : { org_id: orgId }), ...(year === undefined ? {} : { year }) },
  });
// For the 2027 campaign unless the body says otherwise.
const save = (person: Person, body: object) => call(controller.saveTargets, person, { body: { year: 2027, ...body } });
const rowFor = (to: number, year = 2027) =>
  TARGETS.filter((t) => t.setToOrg === to && t.targetYear === year && ["Active", "Draft", "Closed"].includes(t.campaign_status))
    .sort((a, b) => b.id - a.id)[0];

/* ------------------------------------------------------------------ view */

test("view: a National's own target, what it shared out, and each Region with achieved and status", async () => {
  const res = await view(PEOPLE.national);
  assert.equal(res.statusCode, 200);
  const data = res.body.data;

  assert.equal(data.year, 2027);
  assert.deepEqual(data.own, { print: 100, digital: 150, total: 250, status: "Active" });
  assert.deepEqual(data.allocated, { print: 50, digital: 70, total: 120 });
  assert.deepEqual(data.remaining, { print: 50, digital: 80, total: 130 });
  // Print&Digital counts as print; the pending and the 2026 subscriptions do not count.
  assert.deepEqual(data.achieved, { print: 2, digital: 1, total: 3 });
  assert.equal(data.can_allocate, true);
  assert.equal(data.can_edit_own, false);

  const [muscat, sohar] = data.children;
  assert.equal(muscat.name, "Muscat");
  assert.deepEqual(muscat.target, { print: 40, digital: 60, total: 100 });
  // Muscat gave Bousher 50 print, more than its own 40.
  assert.equal(muscat.status, "Over-allocated");
  assert.deepEqual(muscat.achieved, { print: 2, digital: 1, total: 3 });
  assert.equal(muscat.progress.print, 2 / 40);
  assert.equal(sohar.status, "Draft");
  assert.deepEqual(sohar.achieved, { print: 0, digital: 0, total: 0 });
});

test("view: a draft is not given yet, so the Region it is for cannot share it out", async () => {
  const data = (await view(PEOPLE.sohar)).body.data;
  assert.equal(data.own, null);
  assert.equal(data.remaining, null);
  assert.equal(data.can_allocate, false);
  assert.equal(data.blocked_reason, "Your 2027 target has not been set by the country yet.");
});

test("view: a higher level drills into a place below as view-only; outside the branch is refused", async () => {
  const data = (await view(PEOPLE.national, 60)).body.data;
  assert.equal(data.place.name, "Muscat");
  assert.equal(data.can_allocate, false);
  assert.equal(data.blocked_reason, null);
  assert.equal(data.children[0].name, "Bousher");

  assert.equal((await view(PEOPLE.muscat, 2)).statusCode, 403);
  assert.equal((await view(PEOPLE.muscat, 61)).statusCode, 403);
});

test("view: a unit sees its own target and achieved, with nothing to share out", async () => {
  const data = (await view(PEOPLE.unit)).body.data;
  assert.equal(data.own, null);
  assert.deepEqual(data.children, []);
  assert.equal(data.can_allocate, false);
  assert.equal(data.blocked_reason, null);
  assert.deepEqual(data.achieved, { print: 1, digital: 0, total: 1 });
});

test("view: International counts every country for the year shown", async () => {
  const data = (await view(PEOPLE.international)).body.data;
  assert.equal(data.year, 2027);
  assert.equal(data.can_edit_own, true);
  assert.equal(data.can_allocate, true);
  assert.deepEqual(data.children.map((c: any) => [c.name, c.status]), [["Oman", "Set"], ["Saudi", "Not set"]]);
  assert.deepEqual(data.children[0].achieved, { print: 2, digital: 1, total: 3 });
});

/* ------------------------------------------------------------------ save */

test("save: updates an existing target and adds a new one, within the leader's own target", async () => {
  const res = await save(PEOPLE.national, {
    status: "Active",
    children: [{ org_id: 60, print: 60, digital: 70 }, { org_id: 61, print: 40, digital: 80 }],
  });
  assert.equal(res.statusCode, 200, res.body.message);
  assert.equal(res.body.data.saved, 2);
  assert.deepEqual([rowFor(60)!.targetPrint, rowFor(60)!.targetDigital, rowFor(60)!.campaign_status], [60, 70, "Active"]);
  assert.deepEqual([rowFor(61)!.targetPrint, rowFor(61)!.campaign_status, rowFor(61)!.setByName], [40, "Active", "Oman"]);

  // Sohar can now share out its target.
  assert.equal((await view(PEOPLE.sohar)).body.data.can_allocate, true);
});

test("save: each channel must stay within the leader's own target, counting places not sent", async () => {
  // Sohar's draft (10 print) still counts: 95 + 10 > 100.
  const res = await save(PEOPLE.national, { status: "Active", children: [{ org_id: 60, print: 95, digital: 10 }] });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "The print targets add up to 105, more than your print target of 100.");
  assert.equal(rowFor(60)!.targetPrint, 40);

  const digital = await save(PEOPLE.national, { status: "Active", children: [{ org_id: 60, print: 1, digital: 141 }] });
  assert.match(digital.body.message, /digital targets add up to 151/);
});

test("save: only the places directly below, and only once the leader's own target is set", async () => {
  assert.equal((await save(PEOPLE.national, { status: "Active", children: [{ org_id: 70, print: 1, digital: 1 }] })).statusCode, 403);
  assert.equal((await save(PEOPLE.national, { status: "Active", children: [{ org_id: 3, print: 1, digital: 1 }] })).statusCode, 403);

  const blocked = await save(PEOPLE.sohar, { status: "Active", children: [{ org_id: 82, print: 1, digital: 1 }] });
  assert.equal(blocked.statusCode, 400);
  assert.match(blocked.body.message, /has not been set/);

  assert.equal((await save(PEOPLE.unit, { status: "Active", children: [] })).statusCode, 403);
});

test("save: only International sets its own target", async () => {
  const refused = await save(PEOPLE.national, { status: "Active", own: { print: 500, digital: 500 }, children: [] });
  assert.equal(refused.statusCode, 403);

  const res = await save(PEOPLE.international, {
    status: "Active",
    own: { print: 300, digital: 400 },
    children: [{ org_id: 3, print: 200, digital: 250 }],
  });
  assert.equal(res.statusCode, 200, res.body.message);
  const data = (await view(PEOPLE.international)).body.data;
  assert.deepEqual(data.own, { print: 300, digital: 400, total: 700, status: "Active" });
  assert.deepEqual(data.remaining, { print: 0, digital: 0, total: 0 });
});

test("save as draft: refused for a place whose target is already saved", async () => {
  const res = await save(PEOPLE.national, { status: "Draft", children: [{ org_id: 60, print: 1, digital: 1 }] });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Muscat's target is already saved. Use Save to change it.");

  const ok = await save(PEOPLE.national, { status: "Draft", children: [{ org_id: 61, print: 20, digital: 20 }] });
  assert.equal(ok.statusCode, 200);
  assert.equal(rowFor(61)!.campaign_status, "Draft");
});

test("save: targets must be whole numbers, 0 or more", async () => {
  for (const print of [-1, 1.5, "10"]) {
    const res = await save(PEOPLE.national, { status: "Active", children: [{ org_id: 60, print, digital: 1 }] });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "Targets must be whole numbers, 0 or more.");
  }
});

/* ------------------------------------------------------------------ campaign years */

test("years: the latest year with targets by default; a closed earlier year is shown view-only", async () => {
  const latest = (await view(PEOPLE.international)).body.data;
  assert.equal(latest.year, 2027);
  assert.deepEqual(latest.years, [2027, 2026]);
  assert.equal(latest.next_year, 2028);
  // 2027 is still open, so 2028 cannot be started yet.
  assert.equal(latest.can_start_next, false);

  assert.equal(latest.closed, false);

  const past = (await view(PEOPLE.international, undefined, 2026)).body.data;
  assert.equal(past.closed, true);
  // Oman's 2026 target, not its 2027 one.
  assert.deepEqual(past.children[0].target, { print: 70, digital: 80, total: 150 });
  // 2026 subscriptions are counted for 2026: unit 80's one print.
  assert.deepEqual(past.achieved, { print: 1, digital: 0, total: 1 });
  assert.equal(past.can_edit_own, false);
  assert.equal(past.can_allocate, false);
  assert.equal(past.blocked_reason, "The 2026 campaign is closed: its targets can no longer be changed.");
  // A closed year's target still counts as set.
  assert.equal(past.children[0].status, "Set");

  const refused = await save(PEOPLE.international, { year: 2026, status: "Active", own: { print: 1, digital: 1 }, children: [] });
  assert.equal(refused.statusCode, 400);
  assert.equal(refused.body.message, "The 2026 campaign is closed: its targets can no longer be changed.");
  assert.equal(rowFor(2, 2026)!.targetPrint, 70);
});

test("years: International starts the next campaign once the current one is closed", async () => {
  // While 2027 is open, 2028 cannot be started.
  const early = await save(PEOPLE.international, { year: 2028, status: "Active", own: { print: 1, digital: 1 }, children: [] });
  assert.equal(early.statusCode, 400);
  assert.equal(early.body.message, "The 2028 targets can be set once the 2027 campaign is closed.");

  // 2027 closes.
  for (const row of TARGETS) if (row.targetYear === 2027) row.campaign_status = "Closed";
  assert.equal((await view(PEOPLE.international)).body.data.can_start_next, true);

  // Nothing is set for 2028 yet, and the countries cannot share anything out.
  const before = (await view(PEOPLE.national, undefined, 2028)).body.data;
  assert.equal(before.own, null);
  assert.equal(before.can_allocate, false);
  assert.equal(before.blocked_reason, "Your 2028 target has not been set by International yet.");
  assert.equal(before.can_start_next, false);

  const res = await save(PEOPLE.international, {
    year: 2028,
    status: "Active",
    own: { print: 500, digital: 500 },
    children: [{ org_id: 2, print: 200, digital: 300 }],
  });
  assert.equal(res.statusCode, 200, res.body.message);
  assert.equal(rowFor(2, 2028)!.targetYear, 2028);
  // 2027 is untouched, and view-only.
  assert.equal(rowFor(2)!.targetPrint, 100);

  const now = (await view(PEOPLE.national)).body.data;
  assert.equal(now.year, 2028);
  assert.deepEqual(now.own, { print: 200, digital: 300, total: 500, status: "Active" });
  assert.equal(now.can_allocate, true);
  assert.equal((await view(PEOPLE.national, undefined, 2027)).body.data.can_allocate, false);

  // Two years ahead is not open yet.
  const ahead = await save(PEOPLE.international, { year: 2030, status: "Active", own: { print: 1, digital: 1 }, children: [] });
  assert.equal(ahead.statusCode, 400);
});

test("years: a closed year that is the only one is view-only; International starts the next", async () => {
  // Only the closed 2026 campaign: it is shown by default, and 2027 is offered next.
  TARGETS = TARGETS.filter((row) => row.targetYear === 2026);
  const data = (await view(PEOPLE.international)).body.data;
  assert.equal(data.year, 2026);
  assert.equal(data.closed, true);
  assert.equal(data.can_edit_own, false);
  assert.equal(data.next_year, 2027);
  assert.equal(data.can_start_next, true);

  const res = await save(PEOPLE.international, { year: 2027, status: "Active", own: { print: 10, digital: 10 }, children: [] });
  assert.equal(res.statusCode, 200, res.body.message);
  assert.equal((await view(PEOPLE.international)).body.data.year, 2027);
});
