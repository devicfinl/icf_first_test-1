import { prisma } from "../../db/index.js";

export async function findDomainValuesByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return prisma.domainItem.findMany({ where: { did: { in: ids } }, select: { did: true, dvalue: true } });
}

export async function findCountriesByPhoneCodes(phoneCodes: number[]) {
  if (phoneCodes.length === 0) return [];
  return prisma.country.findMany({
    where: { phoneCode: { in: phoneCodes } },
    select: { name: true, phoneCode: true },
  });
}

export async function findDesignationsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return prisma.committeeDesignations.findMany({
    where: { desid: { in: ids } },
    select: { desid: true, desigName: true },
  });
}

export async function findCitiesByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return prisma.city.findMany({ where: { id: { in: ids } }, select: { id: true, city: true } });
}

export async function findOrganisationUnitsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  // connect_auth (the access code) and the unit login passwords are left out on purpose: this data
  // is cached in memory, so mapping them here would put credentials at rest outside the database.
  return prisma.organisationUnit.findMany({
    where: { orgid: { in: ids } },
    select: { orgid: true, orgname: true, hlevel: true, hparent: true },
  });
}

export async function findHierarchyNamesByLevels(levels: number[]) {
  if (levels.length === 0) return [];
  return prisma.hierarchyName.findMany({
    where: { hlevel: { in: levels } },
    select: { hlevel: true, hlevelname: true },
  });
}
