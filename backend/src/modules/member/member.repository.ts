import { prisma } from "../../db/index.js";

// Just what the profile endpoint needs, so the password hash isn't loaded for it.
export function findAccountStatusByUserId(id: number) {
  return prisma.user.findUnique({ where: { id }, select: { userName: true, active: true } });
}

export function findMembershipByMembershipNo(membershipNo: string) {
  return prisma.membershipMaster.findFirst({ where: { membershipNo } });
}

// Optional profile extras: only a few members have a row.
export function findMembershipDetailsByMid(masterMid: number) {
  return prisma.membershipDetail.findFirst({ where: { masterMid } });
}
