import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/index.js";
import { AppError } from "../../utils/app-error.js";
import type { OrganisationLevel } from "../../utils/reference-data.js";
import { handleError, sendSuccess } from "../../utils/response.js";
import {
  LEVEL,
  branchUnder,
  displayPath,
  inPlaceholders,
  openYearFor,
  requireInScope,
  requireLeader,
  selectablePlacesBelow,
} from "./pv.controller.js";

/*
 * Pravasi Vayana targets (pv_subscription_entity): each place gets a print and a digital
 * target from the place directly above it, and shares it out among the places directly below.
 * International sets its own. A row's campaign_status is Active (saved), Draft (only its setter
 * and the levels above see it) or Closed (a finished campaign year: shown, counted, view-only).
 * Targets are per campaign year (targetYear): the latest row per place and year (highest id) is
 * the one in use. Achieved counts approved subscriptions of the same year; Print&Digital rows
 * count as Print, since print includes digital. Only the latest year can be changed while it is
 * open; once it is closed, International starts the next year. Earlier years are view-only.
 */

const TABLE = "pv_subscription_entity";
const ACTIVE = "Active";
const DRAFT = "Draft";
const CLOSED = "Closed";
const IN_USE = `campaign_status IN ('${ACTIVE}', '${DRAFT}', '${CLOSED}')`;
// Column widths of setByLevel / setByName / setToLevel / setToName.
const TEXT_MAX = 100;

type Pair = { print: number; digital: number };
type TargetRow = { id: number; setByOrg: number; setToOrg: number; print: number; digital: number; status: string };
type Db = Pick<typeof prisma, "$queryRawUnsafe" | "$executeRawUnsafe">;

const zero = (): Pair => ({ print: 0, digital: 0 });
// Only the two numbers and their total: a target row also carries its ids.
const withTotal = ({ print, digital }: Pair) => ({ print, digital, total: print + digital });
const share = (achieved: number, target: number) => (target > 0 ? achieved / target : null);

// The row in use for each place in `year`, keyed by setToOrg. `by` picks the rows for these places
// (setToOrg) or the rows these places set (setByOrg). `lock` holds them until the transaction ends.
// No year (nothing subscribed yet) has no targets.
export async function targetRows(
  db: Db,
  by: "setToOrg" | "setByOrg",
  ids: readonly number[],
  year: number | null,
  lock = false,
) {
  const rows = new Map<number, TargetRow>();
  if (ids.length === 0 || year === null) return rows;

  const found = await db.$queryRawUnsafe<
    { id: unknown; setByOrg: unknown; setToOrg: unknown; targetPrint: unknown; targetDigital: unknown; campaign_status: string }[]
  >(
    `SELECT id, setByOrg, setToOrg, targetPrint, targetDigital, campaign_status
     FROM ${TABLE}
     WHERE ${by} IN (${inPlaceholders(ids)}) AND targetYear = ? AND ${IN_USE}
     ORDER BY id DESC${lock ? " FOR UPDATE" : ""}`,
    ...ids,
    year,
  );
  for (const row of found) {
    const place = Number(row.setToOrg);
    if (rows.has(place)) continue;
    rows.set(place, {
      id: Number(row.id),
      setByOrg: Number(row.setByOrg),
      setToOrg: place,
      print: Number(row.targetPrint ?? 0),
      digital: Number(row.targetDigital ?? 0),
      status: row.campaign_status,
    });
  }
  return rows;
}

// The campaign years that have targets, newest first, and those that are closed.
async function targetYears(db: Db): Promise<{ years: number[]; closed: Set<number> }> {
  const rows = await db.$queryRawUnsafe<{ year: unknown; closed: unknown }[]>(
    `SELECT targetYear AS year, MAX(campaign_status = '${CLOSED}') AS closed
     FROM ${TABLE} WHERE ${IN_USE} GROUP BY targetYear ORDER BY year DESC`,
  );
  return {
    years: rows.map((row) => Number(row.year)),
    closed: new Set(rows.filter((row) => Number(row.closed) === 1).map((row) => Number(row.year))),
  };
}

// Approved subscriptions of `year` under `place`: in total and per place directly below it.
async function achievedBelow(place: OrganisationLevel, children: OrganisationLevel[], year: number) {
  const branches = await branchUnder(place.id);
  const total = zero();
  const byChild = new Map<number, Pair>(children.map((child) => [child.id, zero()]));

  const ids = [...branches.keys()];
  if (ids.length > 0) {
    const rows = await prisma.$queryRawUnsafe<{ unit_id: number; subscription_mode: string; count: bigint | number }[]>(
      `SELECT unit_id, subscription_mode, COUNT(*) AS count
       FROM pv_subscription_details
       WHERE unit_id IN (${inPlaceholders(ids)}) AND subscription_year = ? AND approval_status = 'APPROVED'
       GROUP BY unit_id, subscription_mode`,
      ...ids,
      year,
    );
    for (const row of rows) {
      const channel = row.subscription_mode === "Digital" ? "digital" : "print";
      const count = Number(row.count);
      total[channel] += count;
      const child = branches.get(Number(row.unit_id));
      if (child) byChild.get(child)![channel] += count;
    }
  }

  return { total, byChild };
}

const allocatedBy = (rows: Iterable<TargetRow>) => {
  const sums = new Map<number, Pair>();
  for (const row of rows) {
    const sum = sums.get(row.setByOrg) ?? zero();
    sum.print += row.print;
    sum.digital += row.digital;
    sums.set(row.setByOrg, sum);
  }
  return sums;
};

/* ------------------------------------------------------------------ view */

const campaignYear = z.number({ error: "Please choose a valid year." }).int().min(2000).max(2100);

export const targetsQuery = z.strictObject({
  org_id: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().pipe(campaignYear).optional(),
});

type Years = { years: number[]; closed: Set<number> };

// The next campaign can only be started once the current (latest) one is closed.
const canStartNext = ({ years, closed }: Years) => years.length > 0 && closed.has(years[0]!);

// The year a target can still be set for: the latest year with targets while it is open, or the
// next one once the latest is closed. With no targets yet, any year.
const changeable = (year: number, known: Years) => {
  const { years, closed } = known;
  if (years.length === 0) return true;
  if (year === years[0]) return !closed.has(year);
  return year === years[0]! + 1 && canStartNext(known);
};
const lockedMessage = (year: number, { years, closed }: Years) =>
  closed.has(year)
    ? `The ${year} campaign is closed: its targets can no longer be changed.`
    : years.length > 0 && year === years[0]! + 1
      ? `The ${year} targets can be set once the ${years[0]} campaign is closed.`
      : `The ${year} targets can no longer be changed.`;

// GET /pv/targets[?org_id=&year=]: a place's own target for a campaign year, what it has shared
// out, and each place directly below it with its target, achieved and status. Without org_id, the
// leader's own place; without year, the latest year with targets (or, with none yet, the open
// campaign year). Places below the leader's are view-only; only the leader's own place can be edited.
export const targetsView = async (req: Request, res: Response) => {
  try {
    const parsed = targetsQuery.safeParse(req.query);
    if (!parsed.success) throw AppError.badRequest("Please choose a place.");

    const leader = await requireLeader(req.auth);
    const mine = (parsed.data.org_id ?? leader.organisation.id) === leader.organisation.id;
    const path = mine ? leader.path : await requireInScope(leader, parsed.data.org_id!);
    const place = path.at(-1)!;
    const isUnit = place.level === LEVEL.unit;
    const isInternational = place.level === LEVEL.international;

    const known = await targetYears(prisma);
    const { years } = known;
    const latest = years[0] ?? (await openYearFor(leader.organisation.id)) ?? new Date().getFullYear();
    const year = parsed.data.year ?? latest;
    const nextYear = latest + 1;
    const open = changeable(year, known);

    const children = isUnit ? [] : await selectablePlacesBelow(place.id);
    const childIds = children.map((child) => child.id);
    const [rows, setByChildren, achieved] = await Promise.all([
      targetRows(prisma, "setToOrg", [place.id, ...childIds], year),
      targetRows(prisma, "setByOrg", childIds, year),
      achievedBelow(place, children, year),
    ]);
    const sharedOutByChild = allocatedBy(setByChildren.values());

    // A draft is not given yet: the place it is for does not see it.
    let own = rows.get(place.id);
    if (own && own.status === DRAFT && mine && own.setByOrg !== place.id) own = undefined;

    const allocated = zero();
    const childRows = children.map((child) => {
      const row = rows.get(child.id);
      if (row) {
        allocated.print += row.print;
        allocated.digital += row.digital;
      }
      const shared = sharedOutByChild.get(child.id);
      const status = !row
        ? "Not set"
        : row.status === DRAFT
          ? "Draft"
          : shared && (shared.print > row.print || shared.digital > row.digital)
            ? "Over-allocated"
            : "Set";
      const got = achieved.byChild.get(child.id) ?? zero();
      return {
        ...child,
        target: row ? withTotal(row) : null,
        status,
        achieved: withTotal(got),
        progress: {
          print: share(got.print, row?.print ?? 0),
          digital: share(got.digital, row?.digital ?? 0),
        },
        has_children: child.level !== LEVEL.unit,
      };
    });

    const canAllocate = open && mine && children.length > 0 && (isInternational || own?.status === ACTIVE);
    const parentLevel = path.at(-2)?.level;
    const blockedReason =
      !mine || isUnit || canAllocate
        ? null
        : !open
          ? lockedMessage(year, known)
          : children.length === 0
            ? "There are no places below yours to set targets for."
            : `Your ${year} target has not been set by ${parentLevel === LEVEL.national ? "the country" : (parentLevel ?? "the level above")} yet.`;

    return sendSuccess(res, "Targets fetched successfully", {
      place,
      path: displayPath(path),
      top_id: leader.organisation.id,
      year,
      years,
      closed: known.closed.has(year),
      next_year: nextYear,
      // International starts each campaign by setting its own target for the next year.
      // Only once the current campaign is closed.
      can_start_next: mine && isInternational && canStartNext(known),
      own: own ? { ...withTotal(own), status: own.status } : null,
      allocated: withTotal(allocated),
      remaining: own ? withTotal({ print: own.print - allocated.print, digital: own.digital - allocated.digital }) : null,
      achieved: withTotal(achieved.total),
      progress: {
        print: share(achieved.total.print, own?.print ?? 0),
        digital: share(achieved.total.digital, own?.digital ?? 0),
      },
      can_edit_own: open && mine && isInternational,
      can_allocate: canAllocate,
      blocked_reason: blockedReason,
      children: childRows,
    });
  } catch (error) {
    return handleError(res, error, "PV targets error:");
  }
};

/* ------------------------------------------------------------------ save */

const count = z
  .number({ error: "Targets must be whole numbers, 0 or more." })
  .int("Targets must be whole numbers, 0 or more.")
  .min(0, "Targets must be whole numbers, 0 or more.")
  .max(10_000_000, "That target is too large.");

export const saveTargetsBody = z.strictObject({
  // The campaign year the targets are for.
  year: campaignYear,
  // Active saves for the places below to see; Draft keeps it to this level and above.
  status: z.enum([ACTIVE, DRAFT], { error: "Please choose Save or Save as draft." }),
  // International only: its own overall target.
  own: z.strictObject({ print: count, digital: count }).optional(),
  children: z
    .array(z.strictObject({ org_id: z.number().int().positive(), print: count, digital: count }))
    .max(2000),
});

const text = (value: string | null | undefined) => (value ?? "").slice(0, TEXT_MAX);

async function writeTarget(
  db: Db,
  year: number,
  existing: TargetRow | undefined,
  by: OrganisationLevel,
  to: OrganisationLevel,
  target: Pair,
  status: string,
) {
  if (existing) {
    await db.$executeRawUnsafe(
      `UPDATE ${TABLE}
       SET setByOrg = ?, setByLevel = ?, setByName = ?, setToLevel = ?, setToName = ?,
           targetPrint = ?, targetDigital = ?, campaign_status = ?
       WHERE id = ?`,
      by.id, text(by.level), text(by.name), text(to.level), text(to.name),
      target.print, target.digital, status, existing.id,
    );
    return;
  }
  // The id is worked out here: the table may not number rows itself (its first row is id 0).
  await db.$executeRawUnsafe(
    `INSERT INTO ${TABLE}
       (id, setByOrg, setByLevel, setByName, setToOrg, setToLevel, setToName, targetYear, targetPrint, targetDigital, campaign_status)
     SELECT COALESCE(MAX(id), -1) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM ${TABLE}`,
    by.id, text(by.level), text(by.name), to.id, text(to.level), text(to.name),
    year, target.print, target.digital, status,
  );
}

// PUT /pv/targets: the leader sets a year's targets for the places directly below their own (and,
// at International, their own). Each channel's total below must stay within the leader's own
// target for that year. Only the latest year while it is open, or the next one once it is closed.
export const saveTargets = async (req: Request, res: Response) => {
  try {
    const parsed = saveTargetsBody.safeParse(req.body);
    if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0]?.message ?? "Please check the targets.");
    const { year, status, own: ownInput, children: input } = parsed.data;

    const leader = await requireLeader(req.auth);
    const place = leader.organisation;
    const isInternational = place.level === LEVEL.international;

    if (place.level === LEVEL.unit) throw AppError.forbidden("A unit has no places below it to set targets for.");
    if (ownInput && !isInternational) {
      throw AppError.forbidden("Your own target is set by the level above.");
    }
    if (!ownInput && input.length === 0) throw AppError.badRequest("There is nothing to save.");

    const children = await selectablePlacesBelow(place.id);
    const childById = new Map(children.map((child) => [child.id, child]));
    const seen = new Set<number>();
    for (const entry of input) {
      if (!childById.has(entry.org_id)) {
        throw AppError.forbidden("Targets can only be set for the places directly below yours.");
      }
      if (seen.has(entry.org_id)) throw AppError.badRequest("Each place can appear only once.");
      seen.add(entry.org_id);
    }

    const known = await targetYears(prisma);
    if (!changeable(year, known)) throw AppError.badRequest(lockedMessage(year, known));

    const saved = await prisma.$transaction(async (tx) => {
      // Locked, so two leaders of the same place saving at once cannot both pass the check.
      const rows = await targetRows(tx, "setToOrg", [place.id, ...children.map((child) => child.id)], year, true);

      const ownRow = rows.get(place.id);
      const own: Pair | undefined = ownInput ?? (isInternational || ownRow?.status === ACTIVE ? ownRow : undefined);
      if (!own) throw AppError.badRequest(`Your ${year} target has not been set by the level above yet.`);

      if (status === DRAFT) {
        const given = input.find((entry) => rows.get(entry.org_id)?.status === ACTIVE);
        if (given) {
          throw AppError.badRequest(`${childById.get(given.org_id)!.name}'s target is already saved. Use Save to change it.`);
        }
      }

      const next = new Map(input.map((entry) => [entry.org_id, entry]));
      const sum = zero();
      for (const child of children) {
        const value = next.get(child.id) ?? rows.get(child.id);
        if (!value) continue;
        sum.print += value.print;
        sum.digital += value.digital;
      }
      for (const channel of ["print", "digital"] as const) {
        if (sum[channel] > own[channel]) {
          throw AppError.badRequest(
            `The ${channel} targets add up to ${sum[channel]}, more than your ${channel} target of ${own[channel]}.`,
          );
        }
      }

      if (ownInput) await writeTarget(tx, year, ownRow, place, place, ownInput, status);
      for (const entry of input) {
        await writeTarget(tx, year, rows.get(entry.org_id), place, childById.get(entry.org_id)!, entry, status);
      }
      return input.length + (ownInput ? 1 : 0);
    });

    return sendSuccess(res, status === DRAFT ? "Targets saved as draft" : "Targets saved", { saved });
  } catch (error) {
    return handleError(res, error, "PV targets save error:");
  }
};
