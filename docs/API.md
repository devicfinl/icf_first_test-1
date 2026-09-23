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
- **none** — they sign in with no committee context at all

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

## `POST /api/auth/logout` *(auth)*

Revokes the caller's token. The denylist is in memory, so a revoked token becomes usable again if
the process restarts before it would have expired — move it to Redis or a table before running
more than one instance.

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

## `GET /health`

Deliberately **not** the standard envelope: this is read by load balancers and uptime checks,
which want a small flat body and a status code they can act on. It is mounted before the rate
limiter so a probe cannot be throttled.

```json
{ "status": "ok", "database": "connected", "uptime_seconds": 1234 }
```

`503` with `"database": "unreachable"` when the database cannot be reached. The reason is logged,
never returned.
