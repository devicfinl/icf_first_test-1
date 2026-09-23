import { prisma } from "../../db/index.js";

export function findUserByUserName(userName: string) {
  return prisma.user.findFirst({ where: { userName } });
}

export function updateUserPassword(id: number, password: string) {
  return prisma.user.update({ where: { id }, data: { password } });
}

export function findMembershipByMembershipNo(membershipNo: string) {
  return prisma.membershipMaster.findFirst({ where: { membershipNo } });
}

export function findUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

// A member's committee positions. committee_members.cmem_id is membership_master.mid, and one
// member can hold several rows here — in the same committee or in different ones.
export function findCommitteeMembershipsByMemberMid(cmemId: number) {
  return prisma.committeeMember.findMany({
    where: { cmemId },
    select: { cmid: true, cdesignId: true, corgId: true },
    orderBy: { cmid: "asc" },
  });
}

// Only cabinet designations (is_cabinet = 'Y') can be chosen as a session context, so a designation
// missing from this result is one the member holds but cannot sign in as.
export function findCabinetDesignations(desids: number[]) {
  return prisma.committeeDesignations.findMany({
    where: { desid: { in: desids }, isCabinet: "Y" },
    select: { desid: true, desigName: true, desigLevel: true },
  });
}

