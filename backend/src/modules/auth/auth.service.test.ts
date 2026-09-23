import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.JWT_SECRET ??= "test-secret";

type FakeUser = { id: number; userName: string; memberNo: string; password: string; active: number };
type FakeMember = { mid: number; membershipNo: string; unitId: number };
type FakeCommitteeMember = { cmid: number; cdesignId: number; corgId: number; cmemId: number };
type FakeDesignation = { desid: number; desigName: string; desigLevel: number; isCabinet: string };

// The service is tested against fake repositories, so no Prisma (or database) is involved.
const users = new Map<string, FakeUser>();
const members = new Map<string, FakeMember>();
const committeeMembers: FakeCommitteeMember[] = [];
const designations = new Map<number, FakeDesignation>();
const passwordUpdates: { id: number; password: string }[] = [];

mock.module("./auth.repository.js", {
  exports: {
    findUserByUserName: async (userName: string) => users.get(userName) ?? null,
    findUserById: async (id: number) => [...users.values()].find((u) => u.id === id) ?? null,
    updateUserPassword: async (id: number, password: string) => {
      passwordUpdates.push({ id, password });
    },
    findMembershipByMembershipNo: async (membershipNo: string) => members.get(membershipNo) ?? null,
    findCommitteeMembershipsByMemberMid: async (cmemId: number) =>
      committeeMembers.filter((row) => row.cmemId === cmemId),
    findCabinetDesignations: async (desids: number[]) =>
      desids.flatMap((desid) => {
        const designation = designations.get(desid);
        return designation && designation.isCabinet === "Y" ? [designation] : [];
      }),
  },
});

// Only the organisation names/levels are read from here, and the real one would open a database
// connection on import.
mock.module("./reference-data.service.js", {
  exports: {
    resolveOrganisationSummaries: async (unitIds: Iterable<number>) =>
      new Map([...unitIds].map((orgid) => [orgid, { id: orgid, name: `Unit ${orgid}`, level: "Unit" }] as const)),
  },
});

const authService = await import("./auth.service.js");
const { hashPassword } = await import("../../utils/password.js");
const { signAccessToken, verifyToken } = await import("../../utils/jwt.js");
const { isTokenRevoked } = await import("../../utils/token-denylist.js");

// Test credentials are generated per run and never written out as text: they only ever reach the
// in-memory fakes above, and a literal here reads as a leaked credential to secret scanners.
const randomCredential = (length = 24) => randomUUID().replaceAll("-", "").slice(0, length);

const PASSWORD = randomCredential();
const NEW_PASSWORD = randomCredential();
const WRONG_PASSWORD = randomCredential();
const TOO_SHORT = randomCredential(5);
let nextId = 2000;

async function seed(overrides: { active?: number; passwordHash?: string } = {}) {
  const id = ++nextId;
  // Membership numbers are 2 letters + 7 digits (e.g. "OM2400110").
  const membershipNo = `OM${String(id).padStart(7, "0")}`;
  const user = {
    id,
    userName: membershipNo,
    // users.member_no is the membership number, the way into membership_master.
    memberNo: membershipNo,
    password: overrides.passwordHash ?? (await hashPassword(PASSWORD)),
    active: overrides.active ?? 1,
  };
  const member = { mid: id, membershipNo, unitId: id };
  users.set(membershipNo, user);
  members.set(membershipNo, member);
  return { user, member };
}

test("login: correct username and password returns a session token", async () => {
  const { user } = await seed();
  const result = await authService.login({ userName: user.userName, password: PASSWORD });
  assert.equal(typeof result.token, "string");
});

test("login: wrong password and disabled accounts are denied", async () => {
  const { user } = await seed();
  await assert.rejects(authService.login({ userName: user.userName, password: WRONG_PASSWORD }), {
    statusCode: 401,
    message: "Password is wrong",
  });

  const disabled = await seed({ active: 0 });
  await assert.rejects(authService.login({ userName: disabled.user.userName, password: PASSWORD }), {
    statusCode: 401,
    message: "Your login is disabled",
  });
});

// A committee_members row for this member, plus the designation it points at. Non-cabinet
// designations are seeded with isCabinet "N" to check they are filtered out.
function seedPosition(member: FakeMember, { isCabinet = "Y", orgid = member.unitId } = {}) {
  const desid = ++nextId;
  const cmid = ++nextId;

  designations.set(desid, { desid, desigName: `Designation ${desid}`, desigLevel: 1, isCabinet });
  committeeMembers.push({ cmid, cdesignId: desid, corgId: orgid, cmemId: member.mid });

  return { cmid, desid, orgid };
}

// The session context the caller holds, as requireAuth would hand it to the service.
function authFrom(token: string) {
  const claims = verifyToken(token);
  return { userId: String(claims.sub), jti: claims.jti!, exp: claims.exp! };
}

test("login: a member with no committee positions gets a session with no position", async () => {
  const { user } = await seed();

  const result = await authService.login({ userName: user.userName, password: PASSWORD });

  assert.equal(result.position, null);
  assert.deepEqual(result.positions, []);
  assert.equal(result.requiresPositionSelection, false);
  assert.equal(verifyToken(result.token).position, undefined);
});

test("login: a single cabinet position is applied to the session straight away", async () => {
  const { user, member } = await seed();
  const { cmid, desid, orgid } = seedPosition(member);

  const result = await authService.login({ userName: user.userName, password: PASSWORD });

  assert.equal(result.requiresPositionSelection, false);
  assert.equal(result.position?.id, cmid);
  assert.equal(result.position?.organisation.name, `Unit ${orgid}`);
  assert.equal(result.position?.organisation.level, "Unit");
  assert.deepEqual(verifyToken(result.token).position, { cmid, desid, orgid });
});

test("login: several cabinet positions are offered and none is applied yet", async () => {
  const { user, member } = await seed();
  const first = seedPosition(member);
  const second = seedPosition(member, { orgid: member.unitId + 5000 });

  const result = await authService.login({ userName: user.userName, password: PASSWORD });

  assert.equal(result.requiresPositionSelection, true);
  assert.equal(result.position, null);
  assert.deepEqual(
    result.positions.map((position) => position.id),
    [first.cmid, second.cmid],
  );
  // Nothing is chosen for the member: the token carries no context until they select one.
  assert.equal(verifyToken(result.token).position, undefined);
});

test("login: positions whose designation is not cabinet are left out", async () => {
  const { user, member } = await seed();
  const cabinet = seedPosition(member);
  seedPosition(member, { isCabinet: "N" });

  const result = await authService.login({ userName: user.userName, password: PASSWORD });

  assert.deepEqual(
    result.positions.map((position) => position.id),
    [cabinet.cmid],
  );
});

test("selectPosition: choosing a position returns a token carrying it and revokes the old one", async () => {
  const { user, member } = await seed();
  seedPosition(member);
  const second = seedPosition(member);

  const { token: loginToken } = await authService.login({ userName: user.userName, password: PASSWORD });
  const auth = authFrom(loginToken);

  const result = await authService.selectPosition({ auth, positionId: second.cmid });

  assert.equal(result.position.id, second.cmid);
  assert.deepEqual(verifyToken(result.token).position, { cmid: second.cmid, desid: second.desid, orgid: second.orgid });
  assert.ok(isTokenRevoked(auth.jti), "the pre-selection token should no longer work");
});

test("selectPosition: a position the member does not hold is refused", async () => {
  const { user, member } = await seed();
  seedPosition(member);

  const other = await seed();
  const otherPosition = seedPosition(other.member);

  const { token } = await authService.login({ userName: user.userName, password: PASSWORD });

  await assert.rejects(authService.selectPosition({ auth: authFrom(token), positionId: otherPosition.cmid }), {
    statusCode: 403,
  });
});

test("selectPosition: a missing or malformed position id is rejected", async () => {
  const { user, member } = await seed();
  seedPosition(member);

  const { token } = await authService.login({ userName: user.userName, password: PASSWORD });
  const auth = authFrom(token);

  await assert.rejects(authService.selectPosition({ auth }), { statusCode: 400 });
  await assert.rejects(authService.selectPosition({ auth, positionId: "not-a-number" }), { statusCode: 400 });
});

test("selectPosition: a member disabled after signing in can no longer pick a position", async () => {
  const { user, member } = await seed();
  const position = seedPosition(member);

  const { token } = await authService.login({ userName: user.userName, password: PASSWORD });

  users.get(user.userName)!.active = 0;

  await assert.rejects(authService.selectPosition({ auth: authFrom(token), positionId: position.cmid }), {
    statusCode: 401,
    message: "Your login is disabled",
  });
});

test("listPositions: returns the caller's cabinet positions", async () => {
  const { user, member } = await seed();
  const first = seedPosition(member);
  const second = seedPosition(member);
  seedPosition(member, { isCabinet: "N" });

  const positions = await authService.listPositions(String(user.id));

  assert.deepEqual(
    positions.map((position) => position.id),
    [first.cmid, second.cmid],
  );
});

/* ------------------------------------------------------------------ changePassword */

// requireAuth hands the service the caller's claims, including the committee context if any.
function authWithPosition(token: string) {
  const claims = verifyToken(token);
  return {
    userId: String(claims.sub),
    jti: claims.jti!,
    exp: claims.exp!,
    position: (claims.position as { cmid: number; desid: number; orgid: number } | undefined) ?? null,
  };
}

test("changePassword: the right current password sets a new hash and swaps the token", async () => {
  const { user } = await seed();
  const { token } = await authService.login({ userName: user.userName, password: PASSWORD });
  const auth = authWithPosition(token);

  const result = await authService.changePassword({
    auth,
    currentPassword: PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
  });

  const update = passwordUpdates.findLast((u) => u.id === user.id);
  assert.ok(update, "the password should have been updated");
  assert.notEqual(update.password, NEW_PASSWORD, "it must be stored hashed");
  assert.match(update.password, /^\$2y\$/);

  assert.equal(typeof result.token, "string");
  assert.notEqual(result.token, token, "a replacement token should be issued");
  assert.ok(isTokenRevoked(auth.jti), "the old token should be revoked");
});

test("changePassword: a wrong current password is refused and changes nothing", async () => {
  const { user } = await seed();
  const { token } = await authService.login({ userName: user.userName, password: PASSWORD });
  const before = passwordUpdates.length;

  await assert.rejects(
    authService.changePassword({
      auth: authWithPosition(token),
      currentPassword: WRONG_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    }),
    { statusCode: 401, message: "Your current password is not correct." },
  );

  assert.equal(passwordUpdates.length, before, "no password should have been written");
});

test("changePassword: mismatched, short, or unchanged passwords are rejected as bad requests", async () => {
  const { user } = await seed();
  const { token } = await authService.login({ userName: user.userName, password: PASSWORD });
  const auth = authWithPosition(token);

  await assert.rejects(
    authService.changePassword({
      auth,
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: WRONG_PASSWORD,
    }),
    { statusCode: 400, message: "Passwords do not match" },
  );

  await assert.rejects(
    authService.changePassword({ auth, currentPassword: PASSWORD, newPassword: TOO_SHORT, confirmPassword: TOO_SHORT }),
    { statusCode: 400, message: "Password must be at least 8 characters." },
  );

  await assert.rejects(
    authService.changePassword({ auth, currentPassword: PASSWORD, newPassword: PASSWORD, confirmPassword: PASSWORD }),
    { statusCode: 400, message: /different from your current one/ },
  );
});

test("changePassword: the replacement token keeps the committee context the session had", async () => {
  const { user, member } = await seed();
  const position = seedPosition(member);

  const { token } = await authService.login({ userName: user.userName, password: PASSWORD });
  const auth = authWithPosition(token);
  assert.deepEqual(auth.position, { cmid: position.cmid, desid: position.desid, orgid: position.orgid });

  const result = await authService.changePassword({
    auth,
    currentPassword: PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
  });

  assert.deepEqual(verifyToken(result.token).position, {
    cmid: position.cmid,
    desid: position.desid,
    orgid: position.orgid,
  });
});

test("changePassword: a member disabled after signing in can no longer change it", async () => {
  const { user } = await seed();
  const { token } = await authService.login({ userName: user.userName, password: PASSWORD });

  users.get(user.userName)!.active = 0;

  await assert.rejects(
    authService.changePassword({
      auth: authWithPosition(token),
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    }),
    { statusCode: 401, message: "Your login is disabled" },
  );
});

/* ------------------------------------------------------------------ login throttling */

test("login: too many wrong passwords locks the account out, even with the right one", async () => {
  const { user } = await seed();

  // The limiter allows 10 failures per account before it shuts the door.
  for (let i = 0; i < 10; i++) {
    await assert.rejects(authService.login({ userName: user.userName, password: randomCredential() }), {
      statusCode: 401,
    });
  }

  await assert.rejects(authService.login({ userName: user.userName, password: PASSWORD }), {
    statusCode: 429,
    message: /too many sign-in attempts/i,
  });
});

test("login: the lockout is per account and case-insensitive, so it can't be sidestepped", async () => {
  const { user } = await seed();
  const other = await seed();

  for (let i = 0; i < 10; i++) {
    // Varying the capitalisation must not buy a fresh allowance.
    const spelling = i % 2 === 0 ? user.userName.toUpperCase() : user.userName.toLowerCase();
    await assert.rejects(authService.login({ userName: spelling, password: WRONG_PASSWORD }), { statusCode: 401 });
  }

  await assert.rejects(authService.login({ userName: user.userName, password: PASSWORD }), { statusCode: 429 });

  // A different account is unaffected.
  const ok = await authService.login({ userName: other.user.userName, password: PASSWORD });
  assert.equal(typeof ok.token, "string");
});

test("login: a missing username or password is a bad request, not a failed credential check", async () => {
  await assert.rejects(authService.login({ password: PASSWORD }), { statusCode: 400 });
  await assert.rejects(authService.login({ userName: "someone" }), { statusCode: 400 });
});
