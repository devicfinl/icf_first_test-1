import * as referenceDataRepository from "./reference-data.repository.js";

// These lookup tables rarely change, so a value fetched once is worth keeping around rather than
// re-querying on every request - but only the ids actually asked for are ever fetched or cached,
// never a whole table. Each entry expires after an hour, and a miss (id not found in the table) is
// cached too, so a bad/legacy foreign key doesn't get re-queried on every call.
const TTL_MS = 60 * 60 * 1000;

function createLookupCache<K, V>(fetchMany: (ids: K[]) => Promise<Map<K, V>>) {
  const entries = new Map<K, { value: V | undefined; loadedAt: number }>();

  return async function resolve(ids: Iterable<K>): Promise<Map<K, V>> {
    const now = Date.now();
    const uniqueIds = [...new Set(ids)];
    const missing = uniqueIds.filter((id) => {
      const entry = entries.get(id);
      return !entry || now - entry.loadedAt > TTL_MS;
    });

    if (missing.length > 0) {
      const fetched = await fetchMany(missing);
      for (const id of missing) entries.set(id, { value: fetched.get(id), loadedAt: now });
    }

    const result = new Map<K, V>();
    for (const id of uniqueIds) {
      const value = entries.get(id)?.value;
      if (value !== undefined) result.set(id, value);
    }
    return result;
  };
}

const resolveDomainValuesById = createLookupCache<number, string | null>(async (ids) => {
  const rows = await referenceDataRepository.findDomainValuesByIds(ids);
  return new Map(rows.map((row) => [row.did, row.dvalue] as const));
});

const resolveCountryNamesByPhoneCode = createLookupCache<string, string>(async (codes) => {
  const numericCodes = codes.map(Number).filter((code) => Number.isFinite(code));
  const rows = await referenceDataRepository.findCountriesByPhoneCodes(numericCodes);
  return new Map(
    rows.flatMap((row) => (row.phoneCode !== null && row.name !== null ? [[String(row.phoneCode), row.name] as const] : [])),
  );
});

const resolveDesignationNamesById = createLookupCache<number, string>(async (ids) => {
  const rows = await referenceDataRepository.findDesignationsByIds(ids);
  return new Map(rows.map((row) => [row.desid, row.desigName] as const));
});

const resolveCityNamesById = createLookupCache<number, string | null>(async (ids) => {
  const rows = await referenceDataRepository.findCitiesByIds(ids);
  return new Map(rows.map((row) => [row.id, row.city] as const));
});

type Unit = { orgid: number; orgname: string | null; hlevel: number | null; hparent: number | null };

const resolveUnitsById = createLookupCache<number, Unit>(async (ids) => {
  const rows = await referenceDataRepository.findOrganisationUnitsByIds(ids);
  return new Map(rows.map((row) => [row.orgid, row] as const));
});

const resolveLevelNamesByLevel = createLookupCache<number, string | null>(async (levels) => {
  const rows = await referenceDataRepository.findHierarchyNamesByLevels(levels);
  return new Map(rows.filter((row) => row.hlevel !== null).map((row) => [row.hlevel as number, row.hlevelname] as const));
});

// Resolves a batch of domain_items ids (profession, education, blood group, district, ...) at once.
export async function resolveDomainValues(ids: Iterable<number>): Promise<Map<number, string | null>> {
  return resolveDomainValuesById(ids);
}

export async function resolveCountryName(phoneCode: string): Promise<string | null> {
  const trimmed = phoneCode.trim();
  if (!trimmed) return null;
  return (await resolveCountryNamesByPhoneCode([trimmed])).get(trimmed) ?? null;
}

export async function resolveDesignationName(id: number): Promise<string | null> {
  return (await resolveDesignationNamesById([id])).get(id) ?? null;
}

export async function resolveCityName(id: number): Promise<string | null> {
  return (await resolveCityNamesById([id])).get(id) ?? null;
}

export interface OrganisationLevel {
  id: number;
  name: string | null;
  level: string | null;
}

// The display name/level for each of a batch of organisation_unit ids at once - e.g. the
// committee-position org for every membership row a member holds.
export async function resolveOrganisationSummaries(unitIds: Iterable<number>): Promise<Map<number, OrganisationLevel>> {
  const ids = [...new Set(unitIds)];
  const units = await resolveUnitsById(ids);

  const levelIds = [...new Set([...units.values()].map((unit) => unit.hlevel).filter((level): level is number => level !== null))];
  const levelNames = await resolveLevelNamesByLevel(levelIds);

  const result = new Map<number, OrganisationLevel>();
  for (const id of ids) {
    const unit = units.get(id);
    result.set(id, {
      id,
      name: unit?.orgname ?? null,
      level: unit?.hlevel != null ? levelNames.get(unit.hlevel) ?? null : null,
    });
  }
  return result;
}

// Walks from a unit up through hparent to ICF International and returns the chain top-down.
// Resolved one level at a time (through the caches above), so a request only ever fetches the
// units actually on this member's chain, not the whole table - and once a unit and its ancestors
// have been resolved once, later requests through the same or a descendant unit hit the cache.
export async function organisationChain(unitId: number): Promise<OrganisationLevel[]> {
  const chain: OrganisationLevel[] = [];
  const seen = new Set<number>();
  let currentId: number | null = unitId;

  while (currentId !== null && !seen.has(currentId)) {
    seen.add(currentId);

    const unit = (await resolveUnitsById([currentId])).get(currentId);
    if (!unit || (unit.hlevel ?? 0) < 1) break;

    const levelName = unit.hlevel !== null ? (await resolveLevelNamesByLevel([unit.hlevel])).get(unit.hlevel) ?? null : null;
    chain.unshift({ id: unit.orgid, name: unit.orgname, level: levelName });

    if (unit.hlevel === 1 || unit.hparent === null) break;
    currentId = unit.hparent;
  }

  return chain;
}
