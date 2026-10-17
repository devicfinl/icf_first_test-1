# API Reference

Base URL is `/api` (the health endpoint sits at `/health`, outside it). In development Vite
proxies both to the API on port 3000.

## Response envelope

Every endpoint except `/health` answers with the same shape:

```json
{ "success": true, "message": "Login successful", "data": { } }
```

On failure `data` is `null`, and field-level validation failures add an `errors` array:

```json
{
  "success": false,
  "message": "Please enter your password.",
  "data": null,
  "errors": [{ "field": "body.password", "message": "Please enter your password." }]
}
```

`message` is written for a member to read, so a client can show it as-is.

## Status codes

The same meanings apply across every module:

| Code | Meaning |
|---|---|
| 400 | The request is malformed or incomplete — including unknown fields, which are rejected |
| 401 | Not authenticated, or the credentials/token given are not good |
| 403 | Authenticated, but this is not theirs to do |
| 404 | No such thing |
| 413 | Body too large |
| 429 | Too fast, or too many failures |
| 500 | Unexpected failure. The response never carries details; the log line does, tagged with the request id |

Every response carries an `X-Request-Id` header. It is the one thing worth quoting when reporting
a problem, because it ties the report to the server's log line.

## Authentication

A bearer token, sent as `Authorization: Bearer <token>`. Tokens last 15 minutes by default
(`ACCESS_TOKEN_TTL_MINUTES`) and carry the committee position the session acts as.

Three endpoints hand back a **replacement** token and revoke the one used to call them:
`select-position`, `change-password`, and of course `logout`. A client must store the new token
immediately or its next request will be a 401.

---

## `POST /api/auth/member-login`

Signs in with a membership number and password. Public, tightly rate limited.

```json
{ "userName": "MEM001", "password": "..." }
```

```json
{
  "auth": { "token": "…", "token_type": "Bearer", "expires_in": 900 },
  "name": "Muhammed Ali",
  "position": { "id": 12, "designation": { "id": 7, "name": "Secretary", "level": 1 },
                "organisation": { "id": 500, "name": "Dubai Chapter", "level": "Chapter" } },
  "positions": [ ],
  "requires_position_selection": false
}
```

The member's **cabinet** committee positions (`committee_designations.is_cabinet = 'Y'`) decide
what happens next:

- **one position** — it is applied to the token straight away, `requires_position_selection` is false
- **several** — `position` is null and the member must call `select-position` before the session has
  a committee context
- **none** — sign-in is refused with 403 "Only members holding a cabinet committee position can
  sign in." (checked after the password, so it reveals nothing to someone guessing)

A wrong username and a wrong password give the same answer, so the endpoint cannot be used to find
out which membership numbers have accounts. Ten failures against one account locks it for 15
minutes (429), independently of the per-IP limit.

## `GET /api/auth/positions` *(auth)*

The cabinet positions the caller may act as. Used by the selection screen, and to switch later.

## `POST /api/auth/select-position` *(auth)*

```json
{ "positionId": 12 }
```

Returns `{ auth, position }`. The previous token is revoked. A position the caller does not hold
is a 403 — the same answer as one that does not exist, so this cannot be used to probe other
members' committee rows.

## `POST /api/auth/change-password` *(auth)*

```json
{ "currentPassword": "…", "newPassword": "…", "confirmPassword": "…" }
```

Returns `{ auth }` — a replacement token that keeps the session's committee context. The current
password is required so an unlocked browser or a stolen token cannot silently take the account
over. Minimum 8 characters, and it must differ from the current one.

## `POST /api/auth/member-forgot-password`

Public, tightly rate limited.

```json
{ "membershipNo": "MEM001" }
```

Confirms the membership number exists and has a password set, then returns
`{ reset_token, token_type, expires_in }`. The reset token is good for 10 minutes and works exactly
once.

## `POST /api/auth/member-reset-password`

```json
{ "resetToken": "…", "password": "…", "confirmPassword": "…" }
```

Spends the reset token. A session token is not accepted here, and the reset token is revoked on
use. Minimum 8 characters.

## `GET /api/auth/me` *(auth)*

Verifies the caller's token and returns the session behind it. The app calls this once on load to
restore a stored session; a missing, invalid, expired or revoked token is a 401, as is a disabled
account.

```json
{
  "membership_no": "OM2400110",
  "name": "…",
  "position": { "id": 7, "designation": { … }, "organisation": { … } },
  "positions": [ … ],
  "requires_position_selection": false,
  "expires_at": 1790000000
}
```

`position` is the context the token carries, checked against the member's current positions.
`expires_at` is the token's expiry in seconds since the epoch.

## `POST /api/auth/logout` *(auth)*

Revokes the caller's token. The denylist is in memory, so a revoked token becomes usable again if
the process restarts before it would have expired — move it to Redis or a table before running
more than one instance.

## `POST /api/auth/cancel-account` *(auth)*

```json
{ "currentPassword": "…", "confirm": true }
```

Cancels the member's portal account: sets `users.active = 0` and revokes the caller's token, so
later sign-ins get `401 Your login is disabled`. Nothing is deleted — the membership record,
donations and subscription history stay. The office restores access by setting `active` back to 1.
`401` for a wrong password; `400` if `confirm` is not `true`. Uses the tight auth rate limit.

---

## `GET /api/member/profile` *(auth)*

The caller's own membership record, assembled from `membership_master`, `membership_details` and
the reference tables. A member can only ever read their own record.

Values the legacy database stores as `""` come back as `null`. `age` is derived from
`date_of_birth` and is null when the stored date is malformed, which some rows are. `photo_url` is
null unless `MEMBER_PHOTO_BASE_URL` is set.

```json
{
  "profile": {
    "membership_no": "MEM001", "name": "…", "father_name": "…", "photo_url": null,
    "date_of_birth": "1990-06-15", "age": 35, "gender": "…", "is_married": true,
    "member_type": "A", "is_active": true, "is_verified": true, "is_transferred": false,
    "contact":      { "mobile_country": "971", "mobile": "…", "country": "…",
                      "whatsapp": "…", "india_mobile": "…", "email": "…" },
    "address":      { "gulf_address": "…", "city": "…", "house_name": "…",
                      "place": "…", "post_office": "…", "district": "…" },
    "background":   { "profession": "…", "education": "…",
                      "islamic_education": "…", "blood_group": "…" },
    "organisation": { "unit": { }, "designation": "…", "hierarchy": [ ],
                      "india_unit": "…", "india_zone": "…" }
  }
}
```

---

## `GET /api/users` *(auth, admin)*

Paginated account list. Query: `page` (default 1), `pageSize` (default 25, max 100), `search`
(matches name, member number or username).

```json
{ "items": [ ], "page": 1, "page_size": 25, "total": 1888, "total_pages": 76 }
```

## `GET /api/users/:memberNo` *(auth, admin)*

One account by member number.

Both return a fixed set of safe columns; `users.password` is never selected, let alone returned.

**Who counts as an admin:** `users.role` is where the four tiers from `docs/PRD.md`
(`SUPER_ADMIN`, `ADMIN`, `MEMBER`, `GUEST`) belong, but in the live database it is empty on every
row bar one. The legacy system's actual marker is `users.is_office_user`. So a recognised `role`
wins where one has been written, `is_office_user = 1` is the fallback, and everyone else is an
ordinary member. Once roles are backfilled this keeps working unchanged. The role is re-read from
the database on every request, so revoking someone's access takes effect immediately rather than
when their token expires.

---

## Pravasi Vayana registration *(auth, leader)*

Every `/api/pv` endpoint needs a session acting as a **leader**: a cabinet committee position at
**Region**, **Division** or **Unit** level, re-checked on each request. Anyone else gets 403. A leader
only sees and saves places in their own branch of the hierarchy (their own place and below); anything
else is 403.

### `GET /api/pv/registration/context`

```json
{
  "leader": { "id": 70, "name": "Bousher", "level": "Division" },
  "path": [ { "id": 2, "name": "Oman", "level": "National" },
            { "id": 60, "name": "Muscat", "level": "Region" },
            { "id": 70, "name": "Bousher", "level": "Division" } ],
  "choose_unit": true
}
```

`choose_unit` is false for a Unit leader, whose own unit is used.

### `GET /api/pv/registration/children?parent_id=`

The places directly below `parent_id` (Chapter, Region, Division or Unit), for the next dropdown.
Call it again with the chosen place until a `Unit` is chosen; the number of levels depends on the
country (Saudi has a Chapter level, some countries have no Division).

```json
{ "places": [ { "id": 80, "name": "Bousher Unit A", "level": "Unit" } ] }
```

### `GET /api/pv/registration/price?unit_id=`

The open (not Closed) campaign in `vayana_subscription` for the unit's country. A price that is not
set is `null`.

```json
{ "country_code": "OM", "year": 2027, "currency": "OMR", "campaign_status": "Open",
  "prices": { "Print": 5, "Digital": 3.5, "Print&Digital": 6 } }
```

400 when the unit has no country, no price is set, the campaign is closed, or more than one
campaign is open for the country.

### `POST /api/pv/registrations`

Adds a new subscriber and their subscription for the open campaign year.

```json
{
  "unitId": 80, "name": "Mariam Al-Riyami",
  "shopName": "…", "floorNo": "7", "buildingName": "Sun Tower", "street": "…", "area": "…",
  "province": "Muscat",
  "mobileCountry": "968", "mobile": "91678230", "whatsappCountry": "968", "whatsapp": "91678230",
  "email": "…", "contactPersonName": "…",
  "subscriptionMode": "Print", "distributorArea": "…", "deliveryResponsibility": "…",
  "cashReceived": "N"
}
```

Required: `unitId` (a Unit), `name`, `buildingName`, `province`, `mobileCountry`, `mobile`,
`subscriptionMode` (`Print`, `Digital`, `Print&Digital`). `deliveryResponsibility` only with a mode
that includes Print; `whatsapp` needs `whatsappCountry`. Year, currency, amount, approval and
`added_by` are set by the server; sending them is a 400.

201:

```json
{ "subscriber_id": 1001, "registration_type": "NEW", "subscription_year": 2027, "currency": "OMR", "amount": 5 }
```

400 when a subscriber with the same mobile and name already exists: they must be renewed through
the existing-subscriber search instead.

**Renewing** an existing subscriber: send their `subscriber_id` as `subscriberId` (from the lookup
below) with the same fields. The subscriber's name and contact details are updated from the body,
and a `RENEW` subscription is added (`previous_year_user` = Yes, `address_change` = Yes when the
address differs from their previous subscription, `ledger_no` copied from the subscriber). Refused
when their latest subscription is outside the leader's branch (403), when they already have one for
the open year (400), or when the subscriber does not exist (400). The 201 answer has
`"registration_type": "RENEW"`.

### `GET /api/pv/members/search?q=`

ICF members in the leader's branch whose membership number starts with `q` or whose name contains
it (at least 2 characters), for the membership number dropdown; up to 20, `more` when there are
others. `400` when `q` is shorter.

```json
{ "members": [{ "membership_no": "OM0001234", "name": "Nasser Ali", "active": true, "unit": "Bousher Unit B" }], "more": false }
```

### `GET /api/pv/members/lookup?membership_no=`

For a new subscriber who is an ICF member: their membership record (`OM0001234`, any case), to fill
the form. `name`, `mobile_country`, `mobile`, `whatsapp`, `active`, `unit` and `path` (the dropdown
choices below the leader's place down to the member's unit). `existing_subscriber` is set when a
subscriber already has that membership number, so they can be renewed instead. 400 for a malformed
number, 404 when no member has it, 403 when the member's unit is outside the leader's branch.

`POST /api/pv/registrations` takes `isIcfMember` (`Yes` | `No`) and, with `Yes`, `membershipId`;
both are saved on the subscriber (`is_icf_member`, `membership_id`). An unknown membership number
is a 400; a member whose unit is outside the leader's branch is a 403, as in the lookup.

### `GET /api/pv/subscribers/lookup?q=&org_id=`

The "Is Existing Subscriber" search. `q` matches a subscriber number (`subscriber_id`), a mobile
number (digits; with or without the country code and leading zeros), or text in the name, PV ledger
number or address (shop, building, street, area, province); the placeholder ledger `PV100000` never
matches. `org_id` keeps the search to one place in the leader's branch (a division, unit, ...);
with `org_id` alone, that place's subscribers are listed. One of the two is required (400), and text
needs 2 characters. Only subscribers whose latest subscription is in that place (or, without
`org_id`, the leader's branch) are returned, at most 20; `more` is true when there were more. `year` is the open campaign year (null while none is open). `previous.path`
is the organisation dropdown choices below the leader's place down to the unit (empty for a Unit
leader), so the form can set Division and Unit too.

```json
{
  "year": 2027,
  "subscribers": [{
    "subscriber_id": 6, "name": "Laila Hameed", "ledger_no": "PV2006",
    "mobile_country": "968", "mobile": "95550006", "whatsapp_country": "968", "whatsapp": "95550006",
    "email": "laila@example.com", "already_registered_this_year": false,
    "previous": {
      "year": 2026, "unit": { "id": 80, "name": "Bousher Unit A", "level": "Unit" },
      "path": [{ "id": 80, "name": "Bousher Unit A", "level": "Unit" }],
      "subscription_mode": "Print", "shop_name": "Flat 12", "floor_no": "3", "building_name": "Old Tower",
      "street": "Way 2041", "area": "Ruwi", "province": "Muscat", "distributor_area": "Ruwi lead",
      "delivery_responsibility": "Rashid", "contact_person_name": "Hameed"
    }
  }]
}
```

### `GET /api/pv/registrations?year=&page=&page_size=`

Approved new registrations (not renewals) for one year in the leader's branch (their own place and
every place below it), newest first. Public registrations appear once approved. `year` is optional:
without it, the latest year that has subscriptions in the branch. `page` defaults to 1, `page_size`
to 10 (max 100). `years` lists every year with subscriptions, latest first.

```json
{
  "year": 2027, "years": [2027, 2026], "page": 1, "page_size": 10, "total": 23,
  "items": [{
    "subscriber_id": 1001, "name": "Mariam Al-Riyami", "mobile_country": "968", "mobile": "91678230",
    "unit": { "id": 80, "name": "Bousher Unit A", "level": "Unit" },
    "subscription_mode": "Digital", "currency": "OMR", "amount": 3.5, "cash_received": "Y",
    "approval_status": "APPROVED", "registration_method": "DIRECT", "created_at": "2027-01-03T10:00:00.000Z"
  }]
}
```

### `GET /api/pv/analytics?year=&org_id=`

Work progress for one year. Without `org_id`, the leader's own place; with it, a place below it
(drill-down; 403 above or beside). Only approved subscriptions count. `target` is the place's
print + digital target from Set Target (`target_print`, `target_digital`; 0 until it is given, a
draft does not count except International's own); `progress` = subscriptions ÷ target, `null`
without a target. `print` / `digital` are achieved per channel (old `Print&Digital` counts as
print). `membership` is the active members in the place's units. `renewable` = last year's approved subscribers; `paid` = cash received.
`places` has one entry per place directly below (empty for a unit). `scope.top_id` is the leader's
place: the report cannot go above it.

```json
{
  "year": 2027, "years": [2027, 2026],
  "scope": { "place": { "id": 70, "name": "Bousher", "level": "Division" }, "path": [ … ], "top_id": 70 },
  "totals": { "subscriptions": 811, "new": 495, "renewals": 316, "renewable": 420, "paid": 700,
              "print": 500, "digital": 311, "membership": 1248, "total_units": 12,
              "target": 1000, "target_print": 400, "target_digital": 600, "progress": 0.811 },
  "by_mode": { "Print": 300, "Digital": 311, "Print&Digital": 200 },
  "by_day": [{ "day": "2027-01-03", "new": 14, "renewals": 9 }],
  "amounts": [{
    "currency": "OMR", "total": 3600.5, "received": 3100,
    "by_day": [{ "day": "2027-01-03", "total": 120, "received": 95 }]
  }],
  "places": [{ "id": 805, "name": "Ghubra East", "level": "Unit", "subscriptions": 311, "target": 548, "progress": 0.5675, … }]
}
```

### Campaign analysis: `GET /api/pv/analysis/summary`, `/subscriptions`, `/places`

Shared filters (all optional): `year` (default: the place's open campaign year, else the latest),
`org_id` (a place in the leader's branch), `range` (`today`, `yesterday`, `1h`, `8h`, `24h`, `7d`,
`30d`, `campaign` (default, no time limit), `custom` with `from` / `to` as `YYYY-MM-DD`),
`category` (`all` | `new` | `renew`), `payment` (`all` | `paid` | `unpaid`; paid is
`cash_received = 'Y'`), `member` (`all` | `yes` | `no`, from `is_icf_member`), `status`
(`approved` (default) | `pending` | `rejected` | `all`), `search` (name, mobile, ledger number or
subscriber number). Time ranges use the database server's clock on `created_at`.

- `summary`: `target` (the place's print + digital target from Set Target, 0 when none), `totals` (subscriptions, new, renewals, renewable = last year's subscriptions, paid, unpaid) and `amounts` per currency
  (total, received, pending).
- `subscriptions`: adds `tab` (`all` | `new` | `old`), `sort` (`created_at`, `updated_at`, `name`,
  `amount`, `mode`, `category`), `dir`, `page`, `page_size` (25, 50, 100), and `export=1` for every
  matching row (up to 10,000). `old` lists the year before's subscriptions, each with `renewed`.
  Rows carry `unit` and `under` (the places between the report's place and the unit).
- `places`: each place directly below, with subscriptions, new, renewals, `target` (print +
  digital from the targets table) and `achieved`, `rank`, paid / unpaid / `paid_rate` and
  `amounts`, `units` / `active_units` / `participation`, and `last_year` / `growth` /
  `growth_rate` (the whole campaign: the time range is not applied to last year).

### `GET /api/pv/targets?org_id=`

Targets from `vayana_subscription_entity_new`: each place gets a print and a digital target from
the place directly above it (International sets its own). Without `org_id`, the leader's own place;
a place below it is view-only; outside the leader's branch is a 403. Only rows with
`campaign_status` `Active` or `Draft` count, the latest (highest `id`) per place. A `Draft` is not
shown to the place it is for. `achieved` counts approved subscriptions of the open campaign year
of the place's country (`year` is null at International, where each country has its own);
old `Print&Digital` rows count as print.

```json
{ "place": { "id": 2, "name": "Oman", "level": "National" }, "path": [...], "top_id": 2, "year": 2027,
  "own": { "print": 100, "digital": 150, "total": 250, "status": "Active" },
  "allocated": { "print": 50, "digital": 70, "total": 120 },
  "remaining": { "print": 50, "digital": 80, "total": 130 },
  "achieved": { "print": 2, "digital": 1, "total": 3 },
  "progress": { "print": 0.02, "digital": 0.0067 },
  "can_edit_own": false, "can_allocate": true, "blocked_reason": null,
  "children": [{ "id": 60, "name": "Muscat", "level": "Region",
                 "target": { "print": 40, "digital": 60, "total": 100 },
                 "status": "Over-allocated", "achieved": { "print": 2, "digital": 1, "total": 3 },
                 "progress": { "print": 0.05, "digital": 0.0167 }, "has_children": true }] }
```

`status` per child: `Not set`, `Draft`, `Set`, or `Over-allocated` (it gave the places below it
more than its own target in either channel). `can_allocate` is false until the leader's own
target is `Active`; `blocked_reason` says why.

### `PUT /api/pv/targets`

`{ "status": "Active" | "Draft", "own"?: { "print", "digital" }, "children": [{ "org_id", "print", "digital" }] }`

Whole numbers, 0 or more. `children` must be places directly below the leader's own (else 403);
places left out keep their target. `own` is for International only (else 403). 400 when the
leader's own target is not set yet, when the print or digital targets below (sent and kept
together) would add up to more than the leader's own, or for `Draft` on a place whose target is
already `Active`. Checked and written in one transaction with the rows locked.

### `GET /api/pv/renewals?status=&search=&page=&page_size=`

Last year's approved subscribers in the leader's branch, to renew in the open campaign year (or the
latest year with subscriptions when none is open). `status`: `all` (default), `renew` (not yet
renewed) or `renewed`. `search` matches name, mobile or ledger no. Items have the same shape as the
lookup below; `already_registered_this_year` means renewed.

### `GET /api/pv/public-registrations?status=&page=&page_size=`

Registrations made through public links in the leader's branch, newest first. `status`: `PENDING`
(default), `APPROVED` or `REJECTED`.

### `POST /api/pv/public-registrations/{subscriber_id}/approve`

Pending → Approved: the leader is recorded as approver and adder, the subscriber becomes ACTIVE and
the subscription starts counting. 403 outside the leader's branch; 400 when already decided.

### `POST /api/pv/public-registrations/{subscriber_id}/reject`

Body `{ "reason": "…" }` (required). Pending → Rejected with the reason; the subscriber becomes REJECTED.

### `GET /api/pv/subscribers/{subscriber_id}?year=`

One subscriber's view: contact details, one year's subscription in full (default: the latest, or
`year`), and every year as `history` (rejected included). 403 when that year's unit is outside the
leader's branch; 404 for an unknown subscriber or a year they have no subscription for.

```json
{
  "subscriber": { "subscriber_id": 500, "name": "Mariam Al-Riyami", "ledger_no": "PV500",
                  "mobile_country": "968", "mobile": "91000000", "whatsapp_country": "968", "whatsapp": "91000000",
                  "email": "mariam@example.com" },
  "subscription": {
    "year": 2027, "unit": { "id": 805, "name": "Ghubra East", "level": "Unit" },
    "path": [ /* country down to the unit */ ], "form_path": [ /* dropdown choices below the leader */ ],
    "subscription_mode": "Print", "shop_name": "Flat 7", "floor_no": "2", "building_name": "Sun Tower",
    "street": "Way 1", "area": "Ruwi", "province": "Muscat", "distributor_area": "Ruwi lead",
    "delivery_responsibility": "Rashid", "contact_person_name": null,
    "currency": "OMR", "amount": 5, "cash_received": "Y",
    "registration_type": "NEW", "registration_method": "DIRECT", "approval_status": "APPROVED",
    "reject_reason": null, "address_change": "No",
    "added_by": "Abdul Majeed", "approved_by": "Abdul Majeed", "approved_at": "…", "created_at": "…", "updated_at": null
  },
  "history": [ { "year": 2027, "unit": { … }, "subscription_mode": "Print", "currency": "OMR", "amount": 5,
                 "registration_type": "NEW", "approval_status": "APPROVED" } ],
  "allowed_actions": { "edit": true },
  "edit_blocked_reason": null
}
```

`edit` is false (with `edit_blocked_reason`) for an earlier year than the open campaign, or a
rejected registration.

### `PUT /api/pv/subscribers/{subscriber_id}/subscriptions/{year}`

Edits that year's subscription. Body: the `POST /api/pv/registrations` body without `subscriberId`.
Updates the subscriber's name and contact details, and the subscription's unit, address, mode,
distribution and cash received; currency and amount are worked out again from the unit and mode.
Type, method, approval status and year cannot change (sending them is a 400). Refused for an earlier
year or a rejected registration (400), a unit or subscriber outside the branch (403), or a name and
mobile that belong to another subscriber (400). 200:
`{ "subscriber_id": 500, "subscription_year": 2027, "currency": "OMR", "amount": 6 }`

## Pravasi Vayana public link *(no auth)*

A leader shares `/pv/register/{root_id}`, where `root_id` is their own place (Region, Division or
Unit; anything else is 404). The visitor's form has the path down to that place fixed and chooses
the places below it. Every place and unit asked about must be inside `root_id` (403 otherwise).

- `GET /api/public/pv/links/{root_id}`: same shape as `/api/pv/registration/context`.
- `GET /api/public/pv/links/{root_id}/children?parent_id=`: same as `/api/pv/registration/children`.
- `GET /api/public/pv/links/{root_id}/price?unit_id=`: same as `/api/pv/registration/price`.
- `POST /api/public/pv/registrations`: the leader's body with `rootId` and without `cashReceived` and
  `subscriberId`. Always saved as NEW, PUBLIC, PENDING (subscriber PENDING), no adder, cash No. A second
  pending registration with the same mobile for the same year is a 400. Rate limited per IP. 201:
  `{ "subscriber_id": 900, "subscription_year": 2027, "currency": "OMR", "amount": 3.5, "approval_status": "PENDING" }`

## `GET /health`

Deliberately **not** the standard envelope: this is read by load balancers and uptime checks,
which want a small flat body and a status code they can act on. It is mounted before the rate
limiter so a probe cannot be throttled.

```json
{ "status": "ok", "database": "connected", "uptime_seconds": 1234 }
```

`503` with `"database": "unreachable"` when the database cannot be reached. The reason is logged,
never returned.
