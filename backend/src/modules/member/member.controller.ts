import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { prisma } from "../../db/index.js";
import { AppError } from "../../utils/app-error.js";
import {
  organisationChain,
  resolveCityName,
  resolveCountryName,
  resolveDesignationName,
  resolveDomainValues,
} from "../../utils/reference-data.js";
import { handleError, sendError, sendSuccess } from "../../utils/response.js";

// Legacy columns store "" rather than NULL, so blank values are returned as null.
function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function photoUrl(fileName: string): string | null {
  const name = text(fileName);
  if (!name || !env.memberPhotoBaseUrl) return null;
  return `${env.memberPhotoBaseUrl}/${name.split("/").map(encodeURIComponent).join("/")}`;
}

// date_of_birth is a YYYY-MM-DD string; a few legacy rows are malformed and get no age.
function ageFrom(dateOfBirth: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth.trim());
  if (!match) return null;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

// userId is users.id from the session token; a member can only ever read their own record.
async function buildProfile(userId: number) {
  // Just what the profile needs, so the password hash isn't loaded for it.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { userName: true, active: true } });

  if (!user) {
    throw AppError.notFound("Member not found");
  }

  if (user.active !== 1) {
    throw AppError.unauthorized("Your login is disabled");
  }

  // users.user_name is the membership number
  const member = await prisma.membershipMaster.findFirst({ where: { membershipNo: user.userName } });

  if (!member) {
    throw AppError.notFound("Membership record not found");
  }

  // Optional profile extras: only a few members have a row.
  const details = await prisma.membershipDetail.findFirst({ where: { masterMid: member.mid } });

  // Only the ids this member's own record actually points at are fetched, not every reference row.
  const domainIds = [member.professionId, member.educationId, member.islamicEducationId, member.bloodgroupId, member.districtInId].filter(
    (id): id is number => Boolean(id),
  );

  const [domainValues, country, designation, city, hierarchy] = await Promise.all([
    resolveDomainValues(domainIds),
    resolveCountryName(member.mobileCountry),
    member.cmtDesignation > 0 ? resolveDesignationName(member.cmtDesignation) : Promise.resolve(null),
    details?.city ? resolveCityName(details.city) : Promise.resolve(null),
    organisationChain(member.unitId),
  ]);

  const lookup = (id: number | null) => (id ? domainValues.get(id) ?? null : null);
  const unit = hierarchy.at(-1)?.id === member.unitId ? hierarchy.at(-1)! : null;

  return {
    membership_no: member.membershipNo,
    name: text(member.memberName),
    father_name: text(member.fatherName),
    photo_url: photoUrl(member.imageUrl),
    date_of_birth: text(member.dateOfBirth),
    age: ageFrom(member.dateOfBirth),
    gender: text(details?.gender),
    is_married: details?.maritalStatus === "Y" ? true : details?.maritalStatus === "N" ? false : null,
    member_type: text(member.memType),
    is_active: member.active === 1,
    is_verified: member.isverified === "Y",
    is_transferred: member.transferred === "Yes",
    contact: {
      mobile_country: member.mobileCountry,
      mobile: member.mobile,
      country,
      whatsapp: text(member.whatsappNo) ?? text(details?.whatsAppNo),
      india_mobile: text(member.mobileIn),
      email: text(details?.emailId),
    },
    address: {
      gulf_address: text(member.addressGulf),
      city,
      house_name: text(member.housenameIn),
      place: text(member.placeIn),
      post_office: text(member.postIn),
      district: lookup(member.districtInId),
    },
    background: {
      profession: lookup(member.professionId),
      education: lookup(member.educationId),
      islamic_education: lookup(member.islamicEducationId),
      blood_group: lookup(member.bloodgroupId),
    },
    organisation: {
      unit,
      designation,
      hierarchy,
      india_unit: text(member.unitIndia),
      india_zone: text(member.zoneIndia),
    },
  };
}

export const memberProfile = async (req: Request, res: Response) => {
  try {
    // requireAuth has verified the session token; sub is users.id.
    const userId = Number(req.auth?.userId);
    if (!Number.isInteger(userId)) {
      return sendError(res, 401, "Invalid token");
    }

    const profile = await buildProfile(userId);

    return sendSuccess(res, "Profile fetched successfully", { profile });
  } catch (error) {
    return handleError(res, error, "Member profile error:");
  }
};
