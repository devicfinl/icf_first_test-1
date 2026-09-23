import { test, mock } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ??= "test-secret";
// Set before the service is imported: config/env.js reads the environment once, at load.
process.env.MEMBER_PHOTO_BASE_URL = "https://photos.example.com/members/";

type FakeAccount = { userName: string; active: number };
type FakeMember = Record<string, any>;
type FakeDetails = Record<string, any>;

const accounts = new Map<number, FakeAccount>();
const members = new Map<string, FakeMember>();
const details = new Map<number, FakeDetails>();

mock.module("./member.repository.js", {
  exports: {
    findAccountStatusByUserId: async (id: number) => accounts.get(id) ?? null,
    findMembershipByMembershipNo: async (no: string) => members.get(no) ?? null,
    findMembershipDetailsByMid: async (mid: number) => details.get(mid) ?? null,
  },
});

const DOMAIN_VALUES = new Map([
  [10, "Engineer"],
  [20, "Degree"],
  [30, "Hifz"],
  [40, "O+"],
  [50, "Malappuram"],
]);
const COUNTRY_BY_PHONE_CODE = new Map([["971", "United Arab Emirates"]]);
const DESIGNATIONS = new Map([[7, "Secretary"]]);
const CITIES = new Map([[3, "Dubai"]]);

mock.module("../auth/reference-data.service.js", {
  exports: {
    resolveDomainValues: async (ids: Iterable<number>) =>
      new Map([...ids].flatMap((id) => (DOMAIN_VALUES.has(id) ? [[id, DOMAIN_VALUES.get(id)!] as const] : []))),
    resolveCountryName: async (phoneCode: string) => COUNTRY_BY_PHONE_CODE.get(phoneCode.trim()) ?? null,
    resolveDesignationName: async (id: number) => DESIGNATIONS.get(id) ?? null,
    resolveCityName: async (id: number) => CITIES.get(id) ?? null,
    organisationChain: async (unitId: number) => (unitId === 0 ? [] : [{ id: unitId, name: `Unit ${unitId}`, level: "Unit" }]),
  },
});

const memberService = await import("./member.service.js");

// A complete membership_master row. Legacy columns are NOT NULL and store "" for "no value",
// which is exactly what the service has to translate back into null.
function fullMember(overrides: FakeMember = {}): FakeMember {
  return {
    mid: 1,
    membershipNo: "MEM001",
    memberName: "Ada Lovelace",
    fatherName: "Byron",
    unitId: 88,
    mobileCountry: "971",
    mobile: "500000000",
    whatsappNo: "500000000",
    mobileIn: "9000000000",
    addressGulf: "Some building, Dubai",
    housenameIn: "Housename",
    placeIn: "Place",
    postIn: "Post",
    districtInId: 50,
    dateOfBirth: "1990-06-15",
    professionId: 10,
    bloodgroupId: 40,
    educationId: 20,
    islamicEducationId: 30,
    unitIndia: "India Unit",
    zoneIndia: "India Zone",
    imageUrl: "ada.jpg",
    cmtDesignation: 7,
    isverified: "Y",
    memType: "A",
    transferred: "No",
    active: 1,
    ...overrides,
  };
}

function seed(id: number, member: FakeMember | null, detail: FakeDetails | null = null, active = 1) {
  const membershipNo = member?.membershipNo ?? `MISSING${id}`;
  accounts.set(id, { userName: membershipNo, active });
  if (member) members.set(membershipNo, member);
  if (detail && member) details.set(member.mid, detail);
  return id;
}

/* ---------------------------------------------------------------- missing records */

test("an unknown user id is a 404", async () => {
  await assert.rejects(memberService.getProfile(9999), { statusCode: 404, message: "Member not found" });
});

test("a disabled account is refused, even though the record exists", async () => {
  const id = seed(1, fullMember({ mid: 1, membershipNo: "MEM001" }), null, 0);
  await assert.rejects(memberService.getProfile(id), {
    statusCode: 401,
    message: "Your login is disabled",
  });
});

// An account can exist in `users` with no matching row in membership_master: the two tables are
// joined by membership number, not by a foreign key.
test("an account with no membership record is a 404, not a crash", async () => {
  const id = seed(2, null);
  await assert.rejects(memberService.getProfile(id), {
    statusCode: 404,
    message: "Membership record not found",
  });
});

/* ---------------------------------------------------------------- complete record */

test("a complete record maps every section", async () => {
  const id = seed(
    3,
    fullMember({ mid: 3, membershipNo: "MEM003" }),
    { gender: "Female", maritalStatus: "Y", emailId: "ada@example.com", city: 3, whatsAppNo: "500000001" },
  );

  const profile = await memberService.getProfile(id);

  assert.equal(profile.membership_no, "MEM003");
  assert.equal(profile.name, "Ada Lovelace");
  assert.equal(profile.father_name, "Byron");
  assert.equal(profile.gender, "Female");
  assert.equal(profile.is_married, true);
  assert.equal(profile.is_verified, true);
  assert.equal(profile.is_transferred, false);
  assert.equal(profile.is_active, true);
  assert.equal(profile.contact.email, "ada@example.com");
  assert.equal(profile.contact.country, "United Arab Emirates");
  assert.equal(profile.address.city, "Dubai");
  assert.equal(profile.address.district, "Malappuram");
  assert.equal(profile.background.profession, "Engineer");
  assert.equal(profile.background.blood_group, "O+");
  assert.equal(profile.organisation.designation, "Secretary");
  assert.equal(profile.organisation.unit?.id, 88);
});

test("the profile never carries a password or an organisation access code", async () => {
  const id = seed(4, fullMember({ mid: 4, membershipNo: "MEM004" }));
  const serialised = JSON.stringify(await memberService.getProfile(id));

  assert.ok(!/password/i.test(serialised), serialised);
  assert.ok(!/connectAuth|connect_auth/i.test(serialised), serialised);
});

/* ---------------------------------------------------------------- incomplete records */

// Only some members have a membership_details row at all.
test("a member with no details row still gets a profile, with those fields null", async () => {
  const id = seed(5, fullMember({ mid: 5, membershipNo: "MEM005" }));

  const profile = await memberService.getProfile(id);

  assert.equal(profile.gender, null);
  assert.equal(profile.is_married, null);
  assert.equal(profile.contact.email, null);
  assert.equal(profile.address.city, null);
  // The fields that live on membership_master are still there.
  assert.equal(profile.name, "Ada Lovelace");
});

test("blank legacy strings come back as null rather than empty strings", async () => {
  const id = seed(
    6,
    fullMember({
      mid: 6,
      membershipNo: "MEM006",
      fatherName: "   ",
      whatsappNo: "",
      addressGulf: "",
      placeIn: "  ",
      imageUrl: "",
    }),
  );

  const profile = await memberService.getProfile(id);

  assert.equal(profile.father_name, null);
  assert.equal(profile.contact.whatsapp, null);
  assert.equal(profile.address.gulf_address, null);
  assert.equal(profile.address.place, null);
  assert.equal(profile.photo_url, null, "no file name means no photo URL");
});

test("an unmapped reference id becomes null instead of an id leaking through", async () => {
  const id = seed(7, fullMember({ mid: 7, membershipNo: "MEM007", professionId: 999, bloodgroupId: 999 }));

  const profile = await memberService.getProfile(id);

  assert.equal(profile.background.profession, null);
  assert.equal(profile.background.blood_group, null);
});

test("a zero designation is treated as none", async () => {
  const id = seed(8, fullMember({ mid: 8, membershipNo: "MEM008", cmtDesignation: 0 }));
  assert.equal((await memberService.getProfile(id)).organisation.designation, null);
});

/* ---------------------------------------------------------------- derived values */

test("age is derived from the date of birth, and a malformed date yields null", async () => {
  const good = seed(9, fullMember({ mid: 9, membershipNo: "MEM009", dateOfBirth: "1990-06-15" }));
  const profile = await memberService.getProfile(good);
  assert.equal(typeof profile.age, "number");
  assert.ok(profile.age! >= 30 && profile.age! < 130, `unexpected age ${profile.age}`);

  // A handful of legacy rows hold things like "0000-00-00" or free text.
  for (const [id, dateOfBirth] of [[10, "0000-00-00"], [11, "not a date"], [12, ""]] as const) {
    const seeded = seed(id, fullMember({ mid: id, membershipNo: `MEM0${id}`, dateOfBirth }));
    const result = await memberService.getProfile(seeded);
    assert.equal(result.age, null, `expected no age for ${JSON.stringify(dateOfBirth)}`);
  }
});

test("the photo URL is built from the base address and escapes the file name", async () => {
  const id = seed(13, fullMember({ mid: 13, membershipNo: "MEM013", imageUrl: "a member photo.jpg" }));

  const profile = await memberService.getProfile(id);

  assert.equal(profile.photo_url, "https://photos.example.com/members/a%20member%20photo.jpg");
});

test("marital status maps Y and N to booleans and anything else to null", async () => {
  const married = seed(14, fullMember({ mid: 14, membershipNo: "MEM014" }), { maritalStatus: "Y" });
  const single = seed(15, fullMember({ mid: 15, membershipNo: "MEM015" }), { maritalStatus: "N" });
  const unknown = seed(16, fullMember({ mid: 16, membershipNo: "MEM016" }), { maritalStatus: "" });

  assert.equal((await memberService.getProfile(married)).is_married, true);
  assert.equal((await memberService.getProfile(single)).is_married, false);
  assert.equal((await memberService.getProfile(unknown)).is_married, null);
});
