import type { OrganisationLevel } from "../types/auth";

// Region, Division and Unit leaders can add Pravasi Vayana subscribers. The server checks again.
const LEADER_LEVELS = ["Region", "Division", "Unit"];

export function isLeaderLevel(level: string | null | undefined): boolean {
  return LEADER_LEVELS.includes(level ?? "");
}

// "Unit Secretary": the place's level before the designation, unless the designation already says it.
export function roleLabel(designation: string | undefined, level: string | null | undefined): string {
  if (!designation) return "";
  if (!level || designation.toLowerCase().startsWith(level.toLowerCase())) return designation;
  return `${level} ${designation}`;
}

// The member's hierarchy, cut at the place of the position they are acting as (a Division
// leader's path ends at the division, not at their own unit).
export function positionPath(hierarchy: OrganisationLevel[], positionOrgId: number | undefined): OrganisationLevel[] {
  const index = hierarchy.findIndex((place) => place.id === positionOrgId);
  return index >= 0 ? hierarchy.slice(0, index + 1) : hierarchy;
}
