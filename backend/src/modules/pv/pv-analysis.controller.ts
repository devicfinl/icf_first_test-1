import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/index.js";
import { AppError } from "../../utils/app-error.js";
import { resolveOrganisationSummaries, type OrganisationLevel } from "../../utils/reference-data.js";
import { handleError, sendSuccess } from "../../utils/response.js";
import { targetRows } from "./pv-targets.controller.js";
import {
  LEVEL,
  branchUnder,
  displayPath,
  inPlaceholders,
  openYearFor,
  pathBelow,
  requireInScope,
  requireLeader,
  selectablePlacesBelow,
  subscriptionYears,
} from "./pv.controller.js";

/*
 * Campaign analysis: the subscriptions of one campaign year in a leader's branch, filtered the
 * same way on every tab. "Paid" is cash_received = 'Y' (docs/TASKS.md C14). Time ranges use the
 * database server's clock: created_at has no time zone.
 */

/* ------------------------------------------------------------------ filters */

const RANGES = ["today", "yesterday", "1h", "8h", "24h", "7d", "30d", "campaign", "custom"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid date.");

const filterFields = {
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  org_id: z.coerce.number().int().positive().optional(),
  range: z.enum(RANGES).default("campaign"),
  from: isoDate.optional(),
  to: isoDate.optional(),
  category: z.enum(["all", "new", "renew"]).default("all"),
  payment: z.enum(["all", "paid", "unpaid"]).default("all"),
  member: z.enum(["all", "yes", "no"]).default("all"),
  status: z.enum(["approved", "pending", "rejected", "all"]).default("approved"),
  search: z.string().trim().max(100).optional(),
};

export const analysisQuery = z.strictObject(filterFields);
type Filters = z.infer<typeof analysisQuery>;

const SORTS = {
  created_at: "d.created_at",
  updated_at: "d.updated_at",
  name: "m.name",
  amount: "d.amount",
  mode: "d.subscription_mode",
  category: "d.registration_type",
} as const;

export const subscriptionsQuery = z.strictObject({
  ...filterFields,
  tab: z.enum(["all", "new", "old"]).default("all"),
  sort: z.enum(Object.keys(SORTS) as [keyof typeof SORTS, ...(keyof typeof SORTS)[]]).default("created_at"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().refine((size) => [25, 50, 100].includes(size), "Please choose 25, 50 or 100 rows.").default(25),
  // Every matching row (up to EXPORT_MAX) for a download, instead of one page.
  export: z.enum(["1"]).optional(),
});

const EXPORT_MAX = 10_000;

const parse = <T extends z.ZodTypeAny>(schema: T, query: unknown): z.infer<T> => {
  const parsed = schema.safeParse(query);
  if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0]?.message ?? "Please check the filters.");
  return parsed.data;
};

// "d.unit_id IN (...) AND ..." for the filters, with its values in placeholder order. `year` is
// passed separately so the Old Subscribers and Growth tabs can ask for the year before.
function whereFor(filters: Filters, ids: readonly number[], year: number, { withRange = true } = {}) {
  const parts = [`d.unit_id IN (${inPlaceholders(ids)})`, "d.subscription_year = ?"];
  const values: unknown[] = [...ids, year];

  if (filters.status !== "all") {
    parts.push("d.approval_status = ?");
    values.push(filters.status.toUpperCase());
  }
  if (filters.category !== "all") {
    parts.push("d.registration_type = ?");
    values.push(filters.category === "new" ? "NEW" : "RENEW");
  }
  if (filters.payment === "paid") parts.push("d.cash_received = 'Y'");
  if (filters.payment === "unpaid") parts.push("(d.cash_received IS NULL OR d.cash_received <> 'Y')");
  if (filters.member !== "all") {
    parts.push("m.is_icf_member = ?");
    values.push(filters.member === "yes" ? "Yes" : "No");
  }
  if (filters.search) {
    const like = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    parts.push("(m.name LIKE ? OR m.mobile LIKE ? OR m.ledger_no LIKE ? OR d.subscriber_id = ?)");
    values.push(like, like, like, /^\d+$/.test(filters.search) ? Number(filters.search) : -1);
  }
  if (withRange) {
    const since = {
      today: "d.created_at >= CURDATE()",
      yesterday: "d.created_at >= CURDATE() - INTERVAL 1 DAY AND d.created_at < CURDATE()",
      "1h": "d.created_at >= NOW() - INTERVAL 1 HOUR",
      "8h": "d.created_at >= NOW() - INTERVAL 8 HOUR",
      "24h": "d.created_at >= NOW() - INTERVAL 24 HOUR",
      "7d": "d.created_at >= NOW() - INTERVAL 7 DAY",
      "30d": "d.created_at >= NOW() - INTERVAL 30 DAY",
    } as Record<string, string>;
    if (since[filters.range]) parts.push(since[filters.range]!);
    if (filters.range === "custom") {
      if (filters.from) {
        parts.push("d.created_at >= ?");
        values.push(filters.from);
      }
      if (filters.to) {
        parts.push("d.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
        values.push(filters.to);
      }
    }
  }
  return { sql: parts.join(" AND "), values };
}

const FROM = "FROM pv_subscription_details d JOIN pv_subscription_master m ON m.subscriber_id = d.subscriber_id";

// The place the report is for (the leader's own, or one below it), its branch and the year.
async function scopeFor(req: Request, filters: Filters) {
  if (filters.range === "custom" && filters.from && filters.to && filters.from > filters.to) {
    throw AppError.badRequest("The start date must be on or before the end date.");
  }
  const leader = await requireLeader(req.auth);
  const mine = filters.org_id === undefined || filters.org_id === leader.organisation.id;
  const path = mine ? leader.path : await requireInScope(leader, filters.org_id!);
  const place = path.at(-1)!;

  const branches = await branchUnder(place.id);
  const ids = [...branches.keys()];
  const years = await subscriptionYears(ids);
  const year = filters.year ?? (await openYearFor(place.id)) ?? years[0] ?? null;

  return {
    leader,
    place,
    branches,
    ids,
    year,
    years,
    scope: { place, path: displayPath(path), top_id: leader.organisation.id },
  };
}

/* ------------------------------------------------------------------ summary */

// GET /pv/analysis/summary: the cards above every tab, for the filters.
export const analysisSummary = async (req: Request, res: Response) => {
  try {
    const filters = parse(analysisQuery, req.query);
    const { ids, year, years, scope } = await scopeFor(req, filters);

    const totals = { subscriptions: 0, new: 0, renewals: 0, paid: 0, unpaid: 0 };
    const amounts = new Map<string, { currency: string; total: number; received: number }>();

    if (year !== null) {
      const where = whereFor(filters, ids, year);
      const rows = await prisma.$queryRawUnsafe<
        { registration_type: string; cash_received: string | null; currency: string | null; count: unknown; amount: unknown }[]
      >(
        `SELECT d.registration_type, d.cash_received, d.currency, COUNT(*) AS count, SUM(d.amount) AS amount
         ${FROM} WHERE ${where.sql}
         GROUP BY d.registration_type, d.cash_received, d.currency`,
        ...where.values,
      );
      for (const row of rows) {
        const count = Number(row.count);
        const amount = Number(row.amount ?? 0);
        const paid = row.cash_received === "Y";
        totals.subscriptions += count;
        if (row.registration_type === "RENEW") totals.renewals += count;
        else totals.new += count;
        if (paid) totals.paid += count;
        else totals.unpaid += count;

        const currency = row.currency?.trim() || "—";
        const money = amounts.get(currency) ?? { currency, total: 0, received: 0 };
        money.total += amount;
        if (paid) money.received += amount;
        amounts.set(currency, money);
      }
    }

    return sendSuccess(res, "Analysis fetched successfully", {
      year,
      years,
      scope,
      totals,
      amounts: [...amounts.values()].map((money) => ({ ...money, pending: money.total - money.received })),
    });
  } catch (error) {
    return handleError(res, error, "PV analysis summary error:");
  }
};

/* ------------------------------------------------------------------ subscriptions */

type SubscriptionRow = {
  subscriber_id: number;
  name: string;
  mobile_country: string | null;
  mobile: string | null;
  is_icf_member: string | null;
  ledger_no: string | null;
  unit_id: number;
  subscription_year: number | null;
  subscription_mode: string;
  registration_type: string;
  approval_status: string;
  currency: string | null;
  amount: unknown;
  cash_received: string | null;
  added_by: number | null;
  created_at: Date | null;
  updated_at: Date | null;
  renewed?: unknown;
};

// GET /pv/analysis/subscriptions: one page of the subscriptions for the filters. tab=new keeps new
// ones; tab=old lists last year's subscribers, each marked renewed or not this year.
export const analysisSubscriptions = async (req: Request, res: Response) => {
  try {
    const query = parse(subscriptionsQuery, req.query);
    const filters: Filters = query.tab === "new" ? { ...query, category: "new" } : query;
    const { place, ids, year, years, scope } = await scopeFor(req, filters);

    const empty = { year, years, scope, total: 0, page: query.page, page_size: query.page_size, rows: [] };
    if (year === null) return sendSuccess(res, "Subscriptions fetched successfully", empty);

    const old = query.tab === "old";
    const where = whereFor(filters, ids, old ? year - 1 : year);
    const renewed = old
      ? `, EXISTS (SELECT 1 FROM pv_subscription_details r
           WHERE r.subscriber_id = d.subscriber_id AND r.subscription_year = ? AND r.approval_status <> 'REJECTED') AS renewed`
      : "";
    const limit = query.export ? EXPORT_MAX : query.page_size;
    const offset = query.export ? 0 : (query.page - 1) * query.page_size;

    const [[count], rows] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: unknown }[]>(`SELECT COUNT(*) AS total ${FROM} WHERE ${where.sql}`, ...where.values),
      prisma.$queryRawUnsafe<SubscriptionRow[]>(
        `SELECT d.subscriber_id, m.name, m.mobile_country, m.mobile, m.is_icf_member, m.ledger_no, d.unit_id,
                d.subscription_year, d.subscription_mode, d.registration_type, d.approval_status, d.currency,
                d.amount, d.cash_received, d.added_by, d.created_at, d.updated_at${renewed}
         ${FROM} WHERE ${where.sql}
         ORDER BY ${SORTS[query.sort]} ${query.dir === "asc" ? "ASC" : "DESC"}, d.subscriber_id DESC
         LIMIT ? OFFSET ?`,
        ...(old ? [year] : []),
        ...where.values,
        limit,
        offset,
      ),
    ]);

    // Where each row is (below the report's place) and who added it, looked up once each.
    const unitIds = [...new Set(rows.map((row) => row.unit_id))];
    const userIds = [...new Set(rows.map((row) => row.added_by).filter((id): id is number => id !== null))];
    const [paths, users] = await Promise.all([
      Promise.all(unitIds.map(async (id) => [id, await pathBelow(place.id, id)] as const)),
      userIds.length > 0
        ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
        : [],
    ]);
    const pathByUnit = new Map(paths);
    const userName = new Map(users.map((user) => [user.id, user.name]));

    return sendSuccess(res, "Subscriptions fetched successfully", {
      ...empty,
      total: Number(count?.total ?? 0),
      rows: rows.map((row) => {
        const where = pathByUnit.get(row.unit_id) ?? [];
        return {
          subscriber_id: row.subscriber_id,
          name: row.name,
          mobile_country: row.mobile_country,
          mobile: row.mobile,
          is_icf_member: row.is_icf_member,
          ledger_no: row.ledger_no,
          year: row.subscription_year,
          subscription_mode: row.subscription_mode,
          registration_type: row.registration_type,
          approval_status: row.approval_status,
          currency: row.currency,
          amount: row.amount === null ? null : Number(row.amount),
          paid: row.cash_received === "Y",
          unit: where.at(-1) ?? { id: row.unit_id, name: null, level: LEVEL.unit },
          // The places between the report's place and the unit, e.g. Muscat • Bousher.
          under: where.slice(0, -1),
          added_by: row.added_by === null ? null : (userName.get(row.added_by) ?? null),
          created_at: row.created_at,
          updated_at: row.updated_at,
          ...(old ? { renewed: Number(row.renewed) === 1 } : {}),
        };
      }),
    });
  } catch (error) {
    return handleError(res, error, "PV analysis subscriptions error:");
  }
};

/* ------------------------------------------------------------------ places */

type PlaceNumbers = {
  subscriptions: number;
  new: number;
  renewals: number;
  paid: number;
  unpaid: number;
  last_year: number;
  units: number;
  active_units: number;
  amounts: Map<string, { currency: string; received: number; pending: number }>;
};

const emptyNumbers = (): PlaceNumbers => ({
  subscriptions: 0,
  new: 0,
  renewals: 0,
  paid: 0,
  unpaid: 0,
  last_year: 0,
  units: 0,
  active_units: 0,
  amounts: new Map(),
});

// GET /pv/analysis/places: each place directly below the report's place, with what the
// Competition, Participation, Payment and Growth tabs show. Growth compares the whole campaign
// with last year's (the time range is not applied to it).
export const analysisPlaces = async (req: Request, res: Response) => {
  try {
    const filters = parse(analysisQuery, req.query);
    const { place, branches, ids, year, years, scope } = await scopeFor(req, filters);
    const children: OrganisationLevel[] = place.level === LEVEL.unit ? [] : await selectablePlacesBelow(place.id);

    const numbers = new Map(children.map((child) => [child.id, emptyNumbers()]));
    const totals = emptyNumbers();
    const add = (unitId: number, change: (n: PlaceNumbers) => void) => {
      change(totals);
      const child = branches.get(unitId);
      const target = child ? numbers.get(child) : undefined;
      if (target) change(target);
    };

    const [summaries, targets] = await Promise.all([
      resolveOrganisationSummaries(ids),
      targetRows(prisma, "setToOrg", children.map((child) => child.id)),
    ]);
    for (const id of ids) {
      if (summaries.get(id)?.level === LEVEL.unit) add(id, (n) => (n.units += 1));
    }

    if (year !== null) {
      const where = whereFor(filters, ids, year);
      const lastYear = whereFor(filters, ids, year - 1, { withRange: false });
      const [rows, previous] = await Promise.all([
        prisma.$queryRawUnsafe<
          { unit_id: number; registration_type: string; cash_received: string | null; currency: string | null; count: unknown; amount: unknown }[]
        >(
          `SELECT d.unit_id, d.registration_type, d.cash_received, d.currency, COUNT(*) AS count, SUM(d.amount) AS amount
           ${FROM} WHERE ${where.sql}
           GROUP BY d.unit_id, d.registration_type, d.cash_received, d.currency`,
          ...where.values,
        ),
        prisma.$queryRawUnsafe<{ unit_id: number; count: unknown }[]>(
          `SELECT d.unit_id, COUNT(*) AS count ${FROM} WHERE ${lastYear.sql} GROUP BY d.unit_id`,
          ...lastYear.values,
        ),
      ]);

      const withSubscriptions = new Set<number>();
      for (const row of rows) {
        const count = Number(row.count);
        const amount = Number(row.amount ?? 0);
        const paid = row.cash_received === "Y";
        const unitId = Number(row.unit_id);
        withSubscriptions.add(unitId);
        add(unitId, (n) => {
          n.subscriptions += count;
          if (row.registration_type === "RENEW") n.renewals += count;
          else n.new += count;
          if (paid) n.paid += count;
          else n.unpaid += count;
          const currency = row.currency?.trim() || "—";
          const money = n.amounts.get(currency) ?? { currency, received: 0, pending: 0 };
          if (paid) money.received += amount;
          else money.pending += amount;
          n.amounts.set(currency, money);
        });
      }
      for (const unitId of withSubscriptions) {
        if (summaries.get(unitId)?.level === LEVEL.unit) add(unitId, (n) => (n.active_units += 1));
      }
      for (const row of previous) add(Number(row.unit_id), (n) => (n.last_year += Number(row.count)));
    }

    const shape = (n: PlaceNumbers, target: { print: number; digital: number } | null) => {
      const goal = target ? target.print + target.digital : null;
      return {
        subscriptions: n.subscriptions,
        new: n.new,
        renewals: n.renewals,
        target: goal,
        achieved: goal ? n.subscriptions / goal : null,
        paid: n.paid,
        unpaid: n.unpaid,
        paid_rate: n.subscriptions > 0 ? n.paid / n.subscriptions : null,
        amounts: [...n.amounts.values()],
        units: n.units,
        active_units: n.active_units,
        participation: n.units > 0 ? n.active_units / n.units : null,
        last_year: n.last_year,
        growth: n.subscriptions - n.last_year,
        growth_rate: n.last_year > 0 ? (n.subscriptions - n.last_year) / n.last_year : null,
      };
    };

    const rows = children.map((child) => ({
      ...child,
      ...shape(numbers.get(child.id)!, targets.get(child.id) ?? null),
    }));
    // Competition order: share of target first (places without a target last), then count.
    const ranked = [...rows].sort(
      (a, b) => (b.achieved ?? -1) - (a.achieved ?? -1) || b.subscriptions - a.subscriptions,
    );
    const rank = new Map(ranked.map((row, index) => [row.id, index + 1]));

    return sendSuccess(res, "Places fetched successfully", {
      year,
      years,
      scope,
      totals: shape(totals, null),
      places: rows.map((row) => ({ ...row, rank: rank.get(row.id)! })),
    });
  } catch (error) {
    return handleError(res, error, "PV analysis places error:");
  }
};
