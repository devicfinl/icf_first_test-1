# Project Tasks

This is the active roadmap for the ICF member portal. Completed items reflect the current repository; unchecked items are planned work.

## Completed foundation

- [x] Define the product requirements
- [x] Document the module-first architecture
- [x] Split the repo into self-contained `backend/` and `frontend/` apps
- [x] Set up the TypeScript Express API in `backend/`
- [x] Fold the Prisma client into `backend/src/db`
- [x] Generate the Prisma client for the existing MySQL database
- [x] Add environment configuration and database connection lifecycle

## Auth Module

* [x] Member login using **membership number and password**

* [x] JWT access-token generation and verification

* [x] Authenticated logout with token denylisting

* [x] Forgot-password identity verification

* [x] Password reset using a one-time reset token

* [x] Controller and service tests for authentication flows

* [x] **Member Position / Designation Selection After Login**

  * After successful login, use the authenticated member's `member_no` to find the corresponding record in `membership_master` using `membership_no`.
  * Retrieve the member's `mid` from `membership_master`.
  * Use `mid` to find the member's committee memberships in `committee_members` using `cmem_id`.
  * From `committee_members`, retrieve:

    * `cmem_id` – member reference
    * `corg_id` – organisation/committee reference
    * `cdesign_id` – committee designation/position reference
  * Match `corg_id` with `organisation_master.orgid` to retrieve the organisation/committee details.
  * Match `cdesign_id` with `committee_designations.desid`.
  * Only include designations where **`cabinet = 'Y'`**.
  * Return the eligible committee/designation positions associated with the member.
  * If the member has **multiple positions/designations**, whether in the **same committee or different committees**, display them as selectable options after login.
  * The member must select which **committee/position context** they want to use for the current session.
  * The selected position/organisation context should then be included in the authenticated session/JWT context and used for subsequent authorization and data access.

* [x] Login by membership number and password only (mobile/mobile-country sign-in removed)

* [x] Authenticated change-password (`POST /api/auth/change-password`), returning a replacement token

* [x] Per-account lockout on repeated login failures, alongside per-IP rate limiting

* [x] Review request validation and standardize authentication error responses

  * zod schemas at the route boundary (`middlewares/validate.ts`), which also reject unknown fields
  * one status taxonomy across every module: 400 malformed, 401 unauthenticated, 403 not yours, 404 missing, 429 throttled
  * login no longer distinguishes an unknown username from a wrong password

* [x] Controller tests for `GET /positions` and `POST /select-position`


## Frontend (`frontend/`)

- [x] React + Vite app wired to the API (`npm run dev` runs both; Vite proxies `/api`)
- [x] Typed API client for the response envelope, with bearer token and 401 handling
- [x] Session persistence in `sessionStorage`, surviving a refresh
- [x] Login screen (membership number + password)
- [x] Committee position selection after login, and the position shown on the profile
- [x] Member profile screen
- [x] Forgot-password and reset-password screens
- [x] Change-password screen
- [x] Sign out (revokes the token server-side)
- [ ] Public pages: events, news/blog, gallery, contact
- [ ] Admin area (the `/api/users` endpoints exist and are role-gated)
- [ ] Frontend tests

> Change-username was removed rather than built: `users.user_name` **is** the membership number and
> is the join key into `membership_master`, so changing it would break the link between an account
> and its membership record. Giving members a separate display username would need a new column and
> a schema review first.

## Health module

- [x] Add database health check endpoint
- [x] Return a consistent health response
- [x] Add failure-path tests for unavailable database connections

## Member module

- [x] Add authenticated member profile endpoint
- [x] Read membership and profile details from the database
- [x] Add tests for missing, inactive, and incomplete member records
- [ ] Add profile update workflow, if permitted by the business rules

> Not started deliberately: this would be the first endpoint to **write** to `membership_master`,
> a live table the schema maps only partially. Which columns a member may edit, and whether edits
> need approval, is a business decision that has not been made.

## Security hardening

- [x] `GET /api/users` required no authentication and returned whole `users` rows, including
      bcrypt password hashes. Now gated by `requireAuth` + `requireRole`, paginated, and restricted
      to an explicit safe column list.
- [x] Permission tiers enforced server-side (`middlewares/require-role.ts`), re-read from the
      database on every request
- [x] Security headers (helmet), CORS allowlist, JSON body size limit
- [x] Per-IP rate limiting, tighter on the unauthenticated auth endpoints
- [x] Request ids and access logging that never record bodies, headers or query strings
- [x] Graceful shutdown with a deadline, plus `uncaughtException` / `unhandledRejection` handling
- [ ] Move the token denylist and attempt limiter to Redis or a table before running more than one
      instance — both are in-memory, so today they are per-process and are lost on restart
- [ ] Backfill `users.role`; it is empty on every row bar one, so admin access currently rests on
      the legacy `is_office_user` flag
