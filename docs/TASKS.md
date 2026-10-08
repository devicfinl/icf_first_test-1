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
- [x] Session persistence in `localStorage`, surviving a refresh and shared across tabs, verified on load via `GET /api/auth/me`
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



# Pravasi Vayana Module — Task List

Backend (REST API) + web frontend. Tables used: `pv_subscription_master`, `pv_subscription_details`, `vayana_subscription` (prices), and the existing hierarchy and user tables.

---

## 1. What changes

| # | Change | Summary |
|---|--------|---------|
| 1 | Who can add | Only a user holding a **leader position** in the Region, Division or Unit hierarchy can add a subscriber |
| 2 | Organization dropdowns | The dropdowns show only what is under the logged-in leader's own position |
| 3 | Existing subscriber | When "Is Existing Subscriber" = Yes, show **two search fields — Mobile and Ledger No** — to find last year's data and fill the form |
| 4 | Amount | Currency and amount are fetched from the **`vayana_subscription`** table for the unit's country |
| 5 | Form | Two-step "Add Subscriber" form rebuilt to the new design |
| 6 | Registered subscribers list | Table of this year's registered subscribers; click a row to see all details |
| 7 | Renew list | List of last year's subscribers, for renewing; click a row to see all details |
| 8 | Details page | One page showing every detail of a single subscriber |
| 9 | Edit | Edit option for a registered subscriber |
| 10 | Public registration | A public form anyone can fill; it must be approved by committee staff / a leader |
| 11 | Public registrations list | List of public-registered subscribers with their approval status |
| 12 | Analytics report | Progress report that drills down the hierarchy: Country → Regions → Divisions → Units → one unit |

---

## 2. Rules

### 2.1 Who can add a subscriber

- Allowed: users with a leader position at **Region**, **Division** or **Unit** level.
- Everyone else: the Add Subscriber page and its API are blocked (menu entry hidden, API returns 403).
- A leader can only add subscribers to units inside their own position.

### 2.2 Organization dropdowns by position

| Logged-in leader | Country | Region | Unit |
|------------------|---------|--------|------|
| Division leader | fixed (own country) | **dropdown** — regions under their division | **dropdown** — units of the selected region |
| Region leader | fixed (own country) | fixed (own region) | **dropdown** — units of their region |
| Unit leader | fixed (own country) | fixed (own region) | fixed (own unit) |

- "Fixed" = pre-filled and locked; the user cannot change it.
- The Unit dropdown is empty until a Region is chosen (for the Division leader), and resets when the Region changes.
- The server checks the chosen unit again on save; a unit outside the leader's position is rejected.

### 2.3 Existing subscriber lookup

- "Is Existing Subscriber" opens a picker: **Yes / No** check boxes, with **Reset** and **Show Result**.
- **No** → empty form, saved as a NEW registration.
- **Yes** → two search fields appear: **Mobile Number** and **Ledger No**. Either one (or both) can be used.
- The search looks only inside the leader's own position, and returns matching subscribers with their **previous year's** subscription.
- Results are shown as cards: initials, name, mobile, mode + year (e.g. "Digital 2025"), **Renew** badge, address, "View Details".
- Choosing a result fills the form from last year's data: name, address, mobile, WhatsApp, email, contact person, subscription mode, distribution lead, delivery responsibility. Every filled field stays editable.
- Saved as a RENEW registration linked to last year's row (`previous_subscription_id`).
- No match → message "No subscriber found", with the option to continue as a new subscriber.
- Already registered for this year → show a message and block a second registration.

### 2.4 Amount from `vayana_subscription`

- Country comes from the selected unit.
- Read the `vayana_subscription` row for that `country` and the subscription `year`.
- `currency` = the row's currency.
- Amount by subscription mode: Print → `amount`, Digital → `price_digital`, Print&Digital → `price_print_digital`.
- Currency and Amount are **shown, not typed**. They update when the unit or the subscription mode changes.
- The server calculates and saves the currency and amount itself; values sent by the browser are ignored.

### 2.5 Lists (table view)

Three lists, all limited to the logged-in leader's own position:

| List | Shows | Status badge |
|------|-------|--------------|
| Registered subscribers | This year's approved registrations (new and renewed) | Approved, with a New / Renewed tag |
| Renew list | **Last year's** subscribers | Renew (not yet renewed) / Renewed |
| Public registrations | Everything that came through the public form | Pending / Approved / Rejected |

Each row shows: initials, name, mobile, subscription mode (Print / Digital / Print&Digital), status badge, address, and "View Details".

Example row:

| | Name | Mode | Mobile | Status | Address | |
|---|------|------|--------|--------|---------|---|
| MR | Mariam Al-Riyami | Print | +968 9167823045 | Approved | Wadi Kabir Road, Sun Tower, 7th floor, Oman | View Details |

- Clicking **any row** (or "View Details") in any of the three lists opens that subscriber's details page.
- Every list has search (name, mobile, ledger no), filters (unit, mode, status) and paging.

### 2.6 Details page

Shows everything about one subscriber and one year's subscription: organization (country, region, unit), personal, contact, address, subscription (mode, year, distribution lead, delivery responsibility), payment (currency, amount, cash received), registration (new / renew, direct / public, status, added by, approved by and when), and the history of earlier years.

Buttons depend on where the record stands:

| Record | Buttons |
|--------|---------|
| Registered this year | Edit |
| Last year's subscriber, not yet renewed | Renew |
| Public registration, pending | Edit, Approve, Reject |
| Public registration, rejected | none (shows the reason) |

### 2.7 Edit

- A leader can edit a subscriber registered in a unit inside their own position.
- Edit opens the same two-step form, filled with the saved data.
- Editable: personal, contact, address, subscription mode, distribution, cash received, and the unit (within the leader's position).
- Not editable: new / renew, direct / public, approval status, subscription year.
- Currency and amount are recalculated from `vayana_subscription` when the unit or mode changes.
- Only the current year's registration can be edited; earlier years are view-only.

### 2.8 Public registration

- A public page, open without login, with the same Add Subscriber form.
- Differences from the leader's form: Country, Region and Unit are all open dropdowns; there is no "Is Existing Subscriber" search; "Cash Received" is not shown (saved as No).
- Currency and amount are shown from `vayana_subscription`, same as the leader's form.
- Saved as a **new** registration with method **Public** and status **Pending**. It is not counted as a subscriber until approved.
- **Approval:** committee staff / a leader whose position covers the chosen unit reviews it and approves or rejects.
  - Approve → status Approved; the approver and time are recorded; the subscriber appears in the registered subscribers list.
  - Reject → status Rejected with a required reason.
- If the person is already a subscriber, the approver rejects the public entry and renews them from the Renew list.

### 2.9 Analytics report

**Drill-down through the hierarchy.** Each page shows the totals for the place you are in, then a list of the places one level below. Clicking a row opens the same page one level down.

| Page | Totals for | List below shows | Click a row → |
|------|-----------|------------------|---------------|
| Analytics of Country (e.g. Oman) | the whole country | all **regions** of the country | that region's page |
| Analytics of Region (e.g. Oman • Muscat) | the region | all **divisions** of the region | that division's page |
| Analytics of Division (e.g. Oman • Muscat • Bousher) | the division | all **units** of the division | that unit's page |
| Analytics of Unit | the unit | — (detailed data instead of a list) | — |

**Where a user starts.** Each user opens the report at their own level and can only go down from there: a country-level user starts at the country page, a Region leader at their region, a Division leader at their division, a Unit leader at their unit page. Nobody can open a level above or beside their own.

**Top card on the Country, Region and Division pages**

| Item | Meaning |
|------|---------|
| Work Progress % | Subscription ÷ Target |
| Subscription | approved subscriptions this year in this place |
| Target | target for this place |
| New / Renew (ring colours) | share of new and renewed inside the subscription count |
| Total Units | number of units under this place |
| Membership | membership count of this place |
| New | approved new registrations this year |
| Renew | approved renewals this year |

**Each row in the list (region, division or unit)**

| Item | Meaning |
|------|---------|
| Name | region / division / unit name |
| Target | its target (e.g. "120 Target") |
| % and bar | its Subscription ÷ Target |
| New | its new registrations |
| Renewed X/Y | X = renewed this year, Y = last year's subscribers there |
| Paid | subscriptions with payment received |

**Filter chips above the list:** All, High Performers, Needs Attention. The first chip is named after the level listed (All Regions / All Divisions / All Units).

**Unit page**

| Item | Meaning |
|------|---------|
| Work Progress % | Subscription ÷ Target, with the ring showing New and Renew |
| New | count, and % = New ÷ Target |
| Renewed X/Y | X = renewed, Y = last year's subscribers; % = X ÷ Y |
| Payment Completed X/Y | X = paid, Y = Subscription; % = X ÷ Y |
| "Detailed Data" arrow | opens the unit's registered subscribers list |

**Counting rules:** only approved registrations count; pending and rejected public registrations never count. Numbers at a higher level are always the sum of the levels below it.

---

## 3. Form fields

### Step 1

| Section | Field | Type | Saves to |
|---------|-------|------|----------|
| Organization Information | Country | dropdown / fixed (2.2) | from unit |
| | Region | dropdown / fixed (2.2) | from unit |
| | Unit | dropdown / fixed (2.2) | `details.unit_id` |
| Subscriber Information | Is Existing Subscriber | Yes / No picker | decides NEW or RENEW |
| | Mobile Number (search) | text — only when Yes | lookup only |
| | Ledger No (search) | text — only when Yes | lookup only |
| Personal Information | Full Name | text | `master.name` |
| Address Information | Flat/Villa/Shop Name | text | `details.shop_name` |
| | Floor No. | text | `details.floor_no` |
| | Building Name | text | `details.building_name` |
| | Street | text | `details.street` |
| | Area | text | `details.area` |
| | State/Province/Emirate | text | `details.province` |
| Contact Information | Mobile | country code + number | `master.mobile_country`, `master.mobile` |
| | WhatsApp | country code + number | `master.whatsapp_country`, `master.whatsapp` |
| | Email | email | `master.email` |
| | Contact Person / Sponsor | text | `details.contact_person_name` |
| | **Save And Continue** | button → step 2 | |

### Step 2

| Section | Field | Type | Saves to |
|---------|-------|------|----------|
| Subscriber Details | Subscription Mode | dropdown: Print / Digital / Print&Digital | `details.subscription_mode` |
| | Building Name * | text, required | `details.building_name` |
| | State/Province/Emirate * | text, required | `details.province` |
| | Distribution Lead | text | `details.distributor_area` |
| | Delivery responsibility (If Print) | text — only when mode includes Print | `details.delivery_responsibility` |
| Payment Information | Currency | read-only, from `vayana_subscription` | `details.currency` |
| | Amount | read-only, from `vayana_subscription` | `details.amount` |
| | Cash Received From Subscriber? | Yes / No | `details.cash_received` |
| | **Previous year** | button — fill step 2 from last year's subscription (existing subscriber only) | |
| | **Save And Continue** | button → save | |

Set by the system: `subscription_year`, `registration_type` (NEW / RENEW), `registration_method` (DIRECT), `approval_status` (APPROVED), `added_by`, `approved_by`, `approved_at`, `previous_subscription_id`, `ledger_no` (kept from the master record for an existing subscriber).

---

## 4. Backend tasks

### 4.1 Permission and hierarchy

- [ ] NR-BE-01 Service that returns the logged-in user's leader position: level (Division / Region / Unit) and the ID of that division, region or unit, read from the existing position tables.
- [ ] NR-BE-02 Permission guard "can add PV subscriber": allow only Division, Region and Unit leaders; return 403 for everyone else. Apply it to every endpoint below.
- [ ] NR-BE-03 `GET /pv/registration/context` — returns the user's level, the fixed values (country, region, unit where locked) and which dropdowns are open, exactly as in table 2.2.
- [ ] NR-BE-04 `GET /pv/registration/regions` — regions under the user's division (Division leader only).
- [ ] NR-BE-05 `GET /pv/registration/units?region_id=` — units of the region, limited to the user's position. Reject a `region_id` outside the user's position.
- [ ] NR-BE-06 Shared check "unit is inside the user's position", used by search and save.

### 4.2 Existing subscriber lookup

- [ ] NR-BE-07 `GET /pv/subscribers/lookup?mobile=&ledger_no=` — at least one value required. Match `pv_subscription_master.mobile` (with or without country code) and / or `ledger_no`. Limit to subscribers whose last subscription is inside the user's position.
- [ ] NR-BE-08 Each result returns: subscriber ID, name, mobile, WhatsApp, email, ledger no, and the **most recent previous year's** row from `pv_subscription_details` (address fields, mode, year, distribution lead, delivery responsibility, contact person, unit).
- [ ] NR-BE-09 Add `already_registered_this_year` (true / false) to each result.
- [ ] NR-BE-10 Ignore the placeholder ledger `PV100000` in ledger search (it belongs to thousands of rows).
- [ ] NR-BE-11 Normalise mobile input before matching: strip spaces, `+`, leading zeros and the country code.
- [ ] NR-BE-12 Index check: `pv_subscription_master (mobile_country, mobile)` and `(ledger_no)` exist; add if missing.

### 4.3 Price from `vayana_subscription`

- [ ] NR-BE-13 Model for `vayana_subscription` (read-only): `amount`, `price_digital`, `price_print_digital`, `country`, `currency`, `year`, `campaign_status`, `closed_on`.
- [ ] NR-BE-14 `GET /pv/registration/price?unit_id=&year=` — resolve the unit's country, return currency, the three prices, `campaign_status` and `closed_on`.
- [ ] NR-BE-15 Price service: unit + year + mode → currency and amount (rule 2.4). Used by the save endpoint.
- [ ] NR-BE-16 Make the unit → country lookup return the 2-letter code used in `vayana_subscription.country` (AE, SA, QA, BH, KW, OM); add a mapping if the hierarchy tables store it differently.
- [ ] NR-BE-17 Error when no price row exists for the country + year: "Subscription amount not set for this country". Never save amount 0.
- [ ] NR-BE-18 When `campaign_status` is Closed for the country + year, block saving with a clear message.

### 4.4 Save

- [ ] NR-BE-19 `POST /pv/registrations` — one endpoint for both cases, in one transaction:
  - **New** (no `subscriber_id`): insert `pv_subscription_master` (status ACTIVE) + `pv_subscription_details` (type NEW).
  - **Existing** (`subscriber_id` sent): update changed master fields + insert a new `pv_subscription_details` row (type RENEW, `previous_subscription_id` = last year's row, `previous_year_user` = Yes).
- [ ] NR-BE-20 Always set on the server: `registration_method = DIRECT`, `approval_status = APPROVED`, `added_by` = `approved_by` = current user, `approved_at` = now, `subscription_year`, `currency`, `amount`.
- [ ] NR-BE-21 Validation: unit required and inside the user's position; full name; mobile with country code; subscription mode; building name; state/province/emirate; email format when given; delivery responsibility only when mode includes Print.
- [ ] NR-BE-22 Set `address_change = Yes` when an existing subscriber's address differs from last year's.
- [ ] NR-BE-23 Block duplicates: an existing subscriber who already has a row for this year; a "new" subscriber whose mobile + name already exists (answer: use the existing-subscriber search instead).
- [ ] NR-BE-24 Return the saved `subscription_id` and `subscriber_id`.

### 4.5 Quality

- [ ] NR-BE-25 Tests — permission: non-leader gets 403; Unit leader cannot save to another unit; Region leader cannot save to a unit in another region; Division leader cannot use a region outside their division.
- [ ] NR-BE-26 Tests — lookup: by mobile, by ledger no, by both, no match, out-of-position subscriber not returned, already registered flag.
- [ ] NR-BE-27 Tests — price: each country and mode returns the right amount and currency (e.g. OM Digital 3.5 OMR, OM Print 5 OMR, AE 50 AED); missing price row; closed campaign.
- [ ] NR-BE-28 Tests — save: new, existing (renew), duplicate block, amount sent by client is ignored.
- [ ] NR-BE-29 API documentation for the endpoints above.

### 4.6 Lists

- [ ] NR-BE-30 `GET /pv/registrations?year=&unit_id=&mode=&type=&search=&page=` — registered subscribers list: this year's approved rows inside the user's position. Row fields: `subscription_id`, name, initials, mobile with country code, mode, status badge, one-line address.
- [ ] NR-BE-31 `GET /pv/renewals?year=&unit_id=&mode=&status=&search=&page=` — renew list: last year's approved subscribers inside the user's position, each marked `Renew` or `Renewed` (has a row for this year), with last year's mode and year.
- [ ] NR-BE-32 `GET /pv/public-registrations?status=&unit_id=&search=&page=` — public registrations inside the user's position, with Pending / Approved / Rejected.
- [ ] NR-BE-33 Shared list behaviour: search on name, mobile and ledger no; paging with total count; default sort newest first (pending first in the public list).
- [ ] NR-BE-34 Build the one-line address on the server from the address parts, skipping empty ones.

### 4.7 Details

- [ ] NR-BE-35 `GET /pv/registrations/{subscription_id}` — every field listed in 2.6, plus `allowed_actions` (`edit`, `renew`, `approve`, `reject`) worked out from the record's state and the user's position.
- [ ] NR-BE-36 `GET /pv/subscribers/{subscriber_id}/history` — all years for the subscriber, newest first.
- [ ] NR-BE-37 Return 403 when the record's unit is outside the user's position.

### 4.8 Edit

- [ ] NR-BE-38 `PUT /pv/registrations/{subscription_id}` — update master fields (name, mobile, WhatsApp, email) and the details row (address, mode, distribution, cash received, unit). Same validation as save (NR-BE-21).
- [ ] NR-BE-39 Refuse changes to `registration_type`, `registration_method`, approval fields, `subscription_year`, `subscriber_id`.
- [ ] NR-BE-40 Recalculate currency and amount on the server when the unit or mode changes.
- [ ] NR-BE-41 Only the current year's row is editable; a rejected row is not editable.
- [ ] NR-BE-42 Record who edited and when (`updated_at` + an audit log entry with old and new values).

### 4.9 Public registration and approval

- [ ] NR-BE-43 Public lookups without login: countries, regions by country, units by region (active units only), and price by unit.
- [ ] NR-BE-44 `POST /public/pv/registrations` — no login. Same body and validation as NR-BE-19, minus `subscriber_id` and `cash_received`. Always saves type NEW, method PUBLIC, status PENDING, master status PENDING, `added_by` empty, `cash_received` N. Server sets currency and amount.
- [ ] NR-BE-45 Protect the public endpoint: rate limit per IP and per mobile, captcha or OTP on the mobile number.
- [ ] NR-BE-46 Block a second pending public registration with the same mobile for the same year.
- [ ] NR-BE-47 Approver rule: a user may approve or reject only when they are committee staff / a leader whose position covers the registration's unit. One shared permission check.
- [ ] NR-BE-48 `POST /pv/registrations/{id}/approve` — pending → Approved; set `approved_by`, `approved_at`, `added_by`; master status ACTIVE. Return a warning flag when the mobile already belongs to an active subscriber.
- [ ] NR-BE-49 `POST /pv/registrations/{id}/reject` — body `reason` (required); pending → Rejected; save `reject_reason`; master status REJECTED.
- [ ] NR-BE-50 Notify the approvers of the unit when a new public registration arrives; notify nobody outside the unit's hierarchy.
- [ ] NR-BE-51 Pending count for the logged-in approver (`GET /pv/public-registrations/pending-count`) for a menu badge.

### 4.10 Quality (lists, edit, public)

- [ ] NR-BE-52 Tests — lists: each leader level sees only their own units; renew list marks Renew / Renewed correctly; pending and rejected rows never appear in the registered list.
- [ ] NR-BE-53 Tests — edit: allowed fields save; locked fields refused; amount recalculated; past year refused; out-of-position refused.
- [ ] NR-BE-54 Tests — public: always NEW + PENDING whatever the client sends; approve; reject needs a reason; non-approver gets 403; duplicate pending blocked.

### 4.11 Analytics report

- [ ] NR-BE-55 Scope service: from the user's position, return the level they start at (country / region / division / unit) and its ID; reject any request for a place outside or above it (403).
- [ ] NR-BE-56 `GET /pv/analytics/country/{id}?year=&filter=` — country totals (top card) + one row per **region**.
- [ ] NR-BE-57 `GET /pv/analytics/region/{id}?year=&filter=` — region totals + one row per **division**.
- [ ] NR-BE-58 `GET /pv/analytics/division/{id}?year=&filter=` — division totals + one row per **unit**.
- [ ] NR-BE-59 `GET /pv/analytics/unit/{id}?year=` — unit page: progress %, subscription, target, new (count, %), renewed (X, Y, %), payment completed (X, Y, %).
- [ ] NR-BE-60 One shared response shape for the three list levels: `scope` (level, id, name, breadcrumb), `totals` (progress, subscription, target, new, renew, total_units, membership), `rows[]` (id, name, target, progress, new, renewed, renewable, paid, child_level).
- [ ] NR-BE-61 Counting rules in one place: approved rows only, selected year; "renewable" = last year's approved subscribers in that place; "paid" as defined in C14.
- [ ] NR-BE-62 Target and membership lookup per unit, summed upward for division, region and country (source in C13).
- [ ] NR-BE-63 `filter` = `all` | `high` | `attention` using the thresholds in C15; rows sorted by progress %, highest first.
- [ ] NR-BE-64 Performance: one grouped query per page (group by the child level), not one query per row. Index `pv_subscription_details (unit_id, subscription_year, approval_status)`.
- [ ] NR-BE-65 Zero or missing target: return progress as null (not an error, not divide by zero).
- [ ] NR-BE-66 Breadcrumb / scope switcher data: the path to the current place (e.g. Oman • Muscat • Bousher) and the sibling places the user is allowed to switch to.
- [ ] NR-BE-67 Tests with a small fixed data set: unit numbers correct; division = sum of its units; region = sum of its divisions; country = sum of its regions; pending and rejected not counted; out-of-scope request gets 403.

---

## 5. Web frontend tasks

### 5.1 Page and access

- [ ] NR-FE-01 Replace the current new-registration page with the new two-step "Add Subscriber" page (same URL as today).
- [ ] NR-FE-02 Route guard: open the page only for Division, Region and Unit leaders; others see "You do not have permission" and the menu entry is hidden.
- [ ] NR-FE-03 Load the registration context (NR-BE-03) when the page opens; show a loading state until it arrives.

### 5.2 Step 1 — Organization Information

- [ ] NR-FE-04 Country, Region, Unit fields driven by the context: locked fields are pre-filled and disabled; open fields are dropdowns (table 2.2).
- [ ] NR-FE-05 Division leader: Region dropdown loads their regions; choosing a region loads its units; changing the region clears the unit.
- [ ] NR-FE-06 Region leader: Region locked; Unit dropdown loads the region's units.
- [ ] NR-FE-07 Unit leader: all three locked.
- [ ] NR-FE-08 Search inside the Unit dropdown when the list is long.

### 5.3 Step 1 — Subscriber Information (existing subscriber)

- [ ] NR-FE-09 "Is Existing Subscriber" picker: Yes / No check boxes (only one can be ticked), **Reset**, **Show Result**, and "Clear all".
- [ ] NR-FE-10 When Yes: show two inputs — **Mobile Number** and **Ledger No** — with a Search button. At least one must be filled.
- [ ] NR-FE-11 Show results as cards: initials, name, mobile, mode + year tag, **Renew** badge, address, "View Details".
- [ ] NR-FE-12 Selecting a card fills the form (step 1 and step 2) from last year's data and shows a note "Filled from <year> subscription". All fields stay editable.
- [ ] NR-FE-13 "Already registered for this year" result: card is disabled with that message.
- [ ] NR-FE-14 No result: message "No subscriber found" with a button "Add as new subscriber" (switches to No).
- [ ] NR-FE-15 Switching from Yes to No, or pressing Reset / Clear all, clears the filled data after a confirmation.

### 5.4 Step 1 — Personal, Address, Contact

- [ ] NR-FE-16 Fields as in section 3, in the same order and section headings.
- [ ] NR-FE-17 Mobile and WhatsApp with a country-code picker, defaulting to the unit's country; "same as mobile" shortcut for WhatsApp.
- [ ] NR-FE-18 "Save And Continue" validates step 1 and opens step 2; entered data is kept when going back.

### 5.5 Step 2 — Subscriber Details and Payment

- [ ] NR-FE-19 Subscription Mode dropdown: Print / Digital / Print&Digital, each option showing its price (e.g. "Digital — 3.5 OMR").
- [ ] NR-FE-20 Building Name and State/Province/Emirate (required): pre-filled from step 1 and kept in sync, so the user does not type them twice.
- [ ] NR-FE-21 Distribution Lead; Delivery responsibility shown only when the mode includes Print.
- [ ] NR-FE-22 Load the price (NR-BE-14) when the unit is known; Currency and Amount are read-only and update when the mode or unit changes.
- [ ] NR-FE-23 Show amounts with the currency's decimals (OMR, KWD, BHD up to 3; AED, SAR, QAR 2).
- [ ] NR-FE-24 "Cash Received From Subscriber?" as a Yes / No choice (default No).
- [ ] NR-FE-25 "Previous year" button: enabled only for an existing subscriber; fills step 2 from last year's subscription.
- [ ] NR-FE-26 Price not set or campaign closed: show the API message and disable "Save And Continue".
- [ ] NR-FE-27 "Save And Continue": call NR-BE-19, disable the button while saving, show field errors from the API, then open the saved subscriber's view page with a success message.

### 5.6 Layout and quality

- [ ] NR-FE-28 Match the design: header with back button, page title "Add Subscriber", section headings, field labels above inputs, button styles.
- [ ] NR-FE-29 Responsive: single column on phone width; two columns of fields on tablet and desktop.
- [ ] NR-FE-30 Warn before leaving the page or closing the tab with unsaved changes.
- [ ] NR-FE-31 Keyboard and accessibility: labels tied to inputs, logical Tab order, errors focused and readable.
- [ ] NR-FE-32 End-to-end tests: Division leader, Region leader and Unit leader each add a new subscriber; existing subscriber found by mobile; found by ledger no; not found; already registered; price changes with mode; non-leader blocked.

### 5.7 Lists (table view)

- [ ] NR-FE-33 Reusable list component: table on desktop (columns: initials + name, mode, mobile, status, address, View Details), cards on phone width.
- [ ] NR-FE-34 Registered Subscribers page using NR-BE-30, with an "Add Subscriber" button (leaders only).
- [ ] NR-FE-35 Renew List page using NR-BE-31: last year's subscribers, with mode + year tag and Renew / Renewed badge; filter "not yet renewed".
- [ ] NR-FE-36 Public Registrations page using NR-BE-32: Pending / Approved / Rejected badge; default filter Pending.
- [ ] NR-FE-37 Search box (name, mobile, ledger no), filters (unit, mode, status) and paging on all three; keep them in the URL so refresh and back work.
- [ ] NR-FE-38 **Clicking any row** or "View Details" opens the details page for that record.
- [ ] NR-FE-39 Loading, empty ("No subscribers found") and error states for each list.
- [ ] NR-FE-40 Menu entries: Registered Subscribers, Renew List, Public Registrations (with pending-count badge from NR-BE-51).

### 5.8 Details page

- [ ] NR-FE-41 Details page showing all sections in 2.6: profile header (name, unit · region, status, paid), organization, personal, contact, address, subscription, payment, registration info.
- [ ] NR-FE-42 Buttons from `allowed_actions`: Edit, Renew, Approve, Reject — show only the ones allowed.
- [ ] NR-FE-43 History section listing earlier years; each opens that year's details (view-only).
- [ ] NR-FE-44 Phone as a `tel:` link and WhatsApp as a `wa.me` link.
- [ ] NR-FE-45 "Renew" opens the Add Subscriber form filled from last year's data (same behaviour as choosing an existing subscriber, NR-FE-12).

### 5.9 Edit

- [ ] NR-FE-46 "Edit" opens the two-step form filled with the saved data, titled "Edit Subscriber"; the "Is Existing Subscriber" search is hidden.
- [ ] NR-FE-47 Locked items shown read-only: new / renew, direct / public, status, year. Organization dropdowns follow the leader's position (table 2.2).
- [ ] NR-FE-48 Currency and amount refresh when the unit or mode changes.
- [ ] NR-FE-49 Save calls NR-BE-38; on success return to the details page with a success message; "Cancel" returns without saving.

### 5.10 Public registration and approval

- [ ] NR-FE-50 Public page (no login) reusing the Add Subscriber form component in "public" mode: open Country → Region → Unit dropdowns, no existing-subscriber search, no Cash Received field.
- [ ] NR-FE-51 Captcha / OTP step before submit (NR-BE-45).
- [ ] NR-FE-52 After submit: confirmation page "Your registration is waiting for approval", with the submitted summary.
- [ ] NR-FE-53 Approve on the details page: confirmation dialog; show the "mobile already belongs to a subscriber" warning when the API returns it.
- [ ] NR-FE-54 Reject on the details page: dialog with a required reason.
- [ ] NR-FE-55 After approve or reject: refresh the details page, the list and the pending badge.
- [ ] NR-FE-56 Rejected record: show the reason and who rejected it; no action buttons.
- [ ] NR-FE-57 End-to-end tests: row click opens details from all three lists; edit and save; public submit → appears as Pending → approve → appears in registered list; public submit → reject with reason; approver outside the unit cannot see or approve it.

### 5.11 Analytics report

- [ ] NR-FE-58 Analytics entry in the PV menu; it opens the page for the user's own level (from NR-BE-55).
- [ ] NR-FE-59 One reusable "analytics list page" used for Country, Region and Division: title ("Analytics of Country / Region / Division"), scope switcher, top card, filter chips, list of rows.
- [ ] NR-FE-60 Top card: big Work Progress %, ring chart with Subscription over Target and New / Renew colours, and four tiles — Total Units, Membership, New, Renew.
- [ ] NR-FE-61 Row card: name, "<n> Target", progress % and bar, New, Renewed X/Y, Paid, and an arrow.
- [ ] NR-FE-62 **Drill-down:** clicking a region row opens that region's divisions; clicking a division row opens that division's units; clicking a unit row opens the unit page. Each level has its own URL so back, refresh and shared links work.
- [ ] NR-FE-63 Scope switcher (e.g. "Oman • Muscat • Bousher"): shows the current path; lets the user jump up to a parent they are allowed to see, or to a sibling place.
- [ ] NR-FE-64 Filter chips: All (named for the level — All Regions / All Divisions / All Units), High Performers, Needs Attention.
- [ ] NR-FE-65 Unit page: Work Progress card (%, ring with Subscription / Target, New and Renew legend) and Detailed Data card with three bars — New, Renewed X/Y, Payment Completed X/Y.
- [ ] NR-FE-66 "Detailed Data" arrow on the unit page opens the registered subscribers list filtered to that unit.
- [ ] NR-FE-67 Year selector, defaulting to the current subscription year.
- [ ] NR-FE-68 Progress colour by level of progress (green for high, as in the design); show "No target set" when progress is empty.
- [ ] NR-FE-69 Loading skeleton, empty state ("No data for this year") and error state on every analytics page.
- [ ] NR-FE-70 Responsive: single column on phone width; on desktop the top card sits beside the list, or the rows show as a table.
- [ ] NR-FE-71 End-to-end tests: country → region → division → unit drill-down; each leader level opens at the right page and cannot go higher; filters; year change.

---

## 6. Order of work

1. NR-BE-01 → NR-BE-06 and NR-FE-01 → NR-FE-08 (permission + organization dropdowns)
2. NR-BE-13 → NR-BE-18 and NR-FE-19 → NR-FE-26 (price from `vayana_subscription`)
3. NR-BE-19 → NR-BE-24 and NR-FE-16 → NR-FE-18, NR-FE-27 (save a new subscriber)
4. NR-BE-07 → NR-BE-12 and NR-FE-09 → NR-FE-15 (existing subscriber lookup and fill)
5. NR-BE-30 → NR-BE-37 and NR-FE-33 → NR-FE-45 (lists + details page)
6. NR-BE-38 → NR-BE-42 and NR-FE-46 → NR-FE-49 (edit)
7. NR-BE-43 → NR-BE-51 and NR-FE-50 → NR-FE-56 (public registration + approval)
8. NR-BE-55 → NR-BE-66 and NR-FE-58 → NR-FE-70 (analytics report)
9. NR-BE-25 → NR-BE-29, NR-BE-52 → NR-BE-54, NR-BE-67, NR-FE-28 → NR-FE-32, NR-FE-57 and NR-FE-71 (tests + polish)

---

## 7. Points to confirm

- **C1 Hierarchy order.** The analytics report uses **Country → Region → Division → Unit** (region Muscat contains division Bousher, which contains the units). Table 2.2 was written from the earlier rule, where a Division leader chooses a Region and then a Unit — the opposite order. If the analytics order is the right one, table 2.2 and the Add Subscriber form change: a Region leader chooses Division then Unit, a Division leader chooses only the Unit, and the form gets a Division dropdown.
- **C2 Country.** Country is treated as fixed for all three leader levels. Can any leader work across more than one country?
- **C3 "Previous year" button.** Taken to mean "fill step 2 from last year's subscription". If it should only go back to step 1, rename it "Back".
- **C4 Print price.** `amount` in `vayana_subscription` is taken as the Print price, because the table has separate columns only for Digital and Print&Digital.
- **C5 Closed campaign.** All 2026 rows in `vayana_subscription` are "Closed". Saving is blocked when the campaign is closed — confirm, or say which year the new registrations are for.
- **C6 Lookup range.** The existing-subscriber search is limited to the leader's own position. Should a leader be able to find a subscriber who moved in from another unit or region?
- **C7 Required fields.** The design marks only Building Name and State/Province/Emirate as required. Unit, Full Name, Mobile and Subscription Mode are also treated as required.
- **C8 Who approves.** "Committee staff / leader" is taken as any Region, Division or Unit leader whose position covers the chosen unit. Is there a separate committee-staff role, and can a Unit leader approve, or only higher levels?
- **C9 Who can edit.** Edit is allowed for the same leaders who can add. Should only the person who added the record, or only higher levels, be allowed to edit?
- **C10 Public form login.** The public form is open without login and protected by captcha / OTP. Confirm.
- **C11 Registered list contents.** The registered subscribers list shows this year's approved registrations (new and renewed together). Should new and renewed be separate lists?
- **C12 Reject.** A Reject button with a required reason is included for public registrations. Remove it if public entries are only ever approved.
- **C13 Target and Membership.** Where do the Target and Membership numbers come from? In the design both are 1,248, so the target looks like the membership count. The PV tables do not store either.
- **C14 "Paid".** Which column means paid: `cash_received = 'Y'` or `p_status = 1`? They give different counts in the old data.
- **C15 Filter thresholds.** What % is "High Performers" and what % is "Needs Attention"? (Suggested: 70% and above; below 50%.)
- **C16 Country level.** Who can open the country page — only country-level leaders / admins? Is there a level above country (all countries together)?
- **C17 New % on the unit page.** Taken as New ÷ Target (48 of 120 = 40% in the design). The sample numbers in the design do not all add up, so confirm each percentage rule in 2.9.