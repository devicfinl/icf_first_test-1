# Architecture

## System overview

This repository holds two self-contained TypeScript apps side by side: an Express API and a React single-page app. Neither depends on the other at build time, and each owns its dependencies and its own `.env`, so either can be built and deployed alone. The root `package.json` is a convenience runner and manages nothing.

| Area | Technology |
|---|---|
| Runtime | Node.js |
| API | Express 5 |
| Language | TypeScript |
| Database | MySQL |
| ORM | Prisma |
| Authentication | JWT bearer tokens |
| Password hashing | Argon2 or bcryptjs, depending on the use case |
| Frontend | React 19 + Vite, React Router |
| Validation | zod, at the route boundary |

## Repository layout

```text
icf-first/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma                 # MySQL schema mapping
│   ├── prisma.config.ts
│   ├── src/
│   │   ├── app.ts                        # Express app, security middleware, error handling
│   │   ├── server.ts                     # Startup, database lifecycle, graceful shutdown
│   │   ├── config/
│   │   │   └── env.ts                    # Environment, validated once at startup
│   │   ├── db/
│   │   │   ├── prisma.ts                 # Prisma client lifecycle
│   │   │   ├── ssh-tunnel.ts             # Optional database SSH tunnel
│   │   │   └── generated/prisma/         # Generated Prisma client
│   │   ├── middlewares/
│   │   │   ├── require-auth.ts           # Bearer token verification
│   │   │   ├── require-role.ts           # Permission tier gate
│   │   │   ├── validate.ts               # zod request validation
│   │   │   ├── rate-limit.ts             # Per-IP limits
│   │   │   └── request-context.ts        # Request id and access logging
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── auth.controller.ts
│   │   │   ├── health/
│   │   │   │   ├── health.routes.ts
│   │   │   │   └── health.controller.ts
│   │   ├── test/                         # Test-only helpers, excluded from the build
│   │   ├── types/express.d.ts            # Express request extensions
│   │   └── utils/                        # Tokens, passwords, errors, responses, throttling, reference data
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── vite.config.ts                    # Dev server and /api proxy
│   ├── src/
│   │   ├── main.tsx                      # Entry point and providers
│   │   ├── App.tsx                       # Routes
│   │   ├── api/axios.ts                  # API client: token header, 401 handling, envelope
│   │   ├── lib/session.ts                # Session persistence (localStorage)
│   │   ├── components/                   # Shared UI and the route guard
│   │   ├── pages/                        # Screens
│   │   ├── slices/ store/ thunks/        # Redux Toolkit state
│   │   ├── types/auth.ts                 # Shapes mirroring the API
│   │   └── utilities/                    # Form schemas and helpers
│   └── package.json
└── docs/
```

## API modules

Every feature module keeps its HTTP entry points, logic and input rules together in three files:

```text
modules/<feature>/
├── <feature>.routes.ts       # HTTP verbs, paths, and middleware wiring
├── <feature>.controller.ts   # Request handling, business rules, database queries, response formatting
└── <feature>.validation.ts   # zod schemas for body, query and params
```

The validation file is optional: `health` and `member` have none because they accept no input, and `auth` defines its schemas at the top of `auth.controller.ts`. Routes should only compose middleware and controllers. Controllers own the feature's logic and query the database through the shared Prisma client from `src/db`.

### `auth`

The `auth` module has only two files.

- `auth.routes.ts` exposes member login, logout, forgot-password, reset-password, change-password, and the committee position endpoints (`GET /positions`, `POST /select-position`). It passes the zod request schemas to the validate middleware, which runs before any controller.
- `auth.controller.ts` defines the zod request schemas (login, select-position, change-password) and handles identity checks, password verification, JWT creation, password resets and changes, per-account lockout, token revocation, and the committee position a session acts as. It reads and updates users, memberships and committee positions through the shared Prisma client.

Committee positions are labelled on login using `utils/reference-data.ts` (see Shared API infrastructure).

Login returns the member's cabinet positions. One is applied to the session immediately; several
require `POST /select-position`, which issues a replacement token carrying the chosen context and
revokes the previous one.

Login reports the same failure for an unknown username as for a wrong password, so it cannot be used to discover which membership numbers have accounts.

`select-position` and `change-password` both hand back a replacement token and revoke the one used to call them, so a captured token stops working the moment the session changes.

Mounted at `/api/auth`.

### `health`

- `health.routes.ts` exposes the health endpoint.
- `health.controller.ts` pings the database and formats the health response.

No validation file: the endpoint takes no input.

Mounted at `/health`.




## Frontend

`frontend/` is a React single-page app using Redux Toolkit for state and React Router for
navigation. `src/api/axios.ts` is the only place that talks to the API.

- The API authenticates with a bearer token, not a cookie. A request interceptor attaches it and a
  response interceptor clears the session on a 401, so the app stops sending a token it knows is
  dead.
- The session is kept in `localStorage` (`src/lib/session.ts`), so it is shared by every tab and
  survives a reload until sign-out or token expiry. On load the store verifies it once with
  `GET /api/auth/me` (`restoreSession`); guarded screens show a loading state until that finishes.
  Tabs follow each other's sign-in, token swaps and sign-out through the `storage` event.
- `components/ProtectedLayout.tsx` guards the signed-in area and sends a member who holds several
  committee positions to the picker before anything else loads.
- `select-position` and `change-password` return a replacement token, which the thunks store before
  the next request goes out.
- The API client cannot import the store (the store imports the thunks, which import the client),
  so it reports an expired token through a callback registered in `store/store.ts`.

## Request flow

```text
HTTP request
    │
    ▼
app.ts
    ├── helmet, cors, request id + logging
    ├── JSON parsing (size limited)
    ├── per-IP rate limiting
    ├── module router
    └── 404 / error handling
        │
        ▼
    <feature>.routes.ts      ── require-auth, require-role, validate (<feature>.validation.ts), then the controller
        │
        ▼
    <feature>.controller.ts  ── business rules, database queries, response mapping; input is already validated
        │
        ▼
    src/db                   ── Prisma client and MySQL
```

## Shared API infrastructure

- `config/env.ts` reads and validates every runtime setting once at startup, so a missing or malformed value fails immediately with a clear message.
- `middlewares/require-auth.ts` verifies bearer tokens and attaches authenticated claims to `req.auth`.
- `middlewares/require-role.ts` gates administrative routes, re-reading the caller's tier from the database on every request so revoking access takes effect at once.
- `middlewares/validate.ts` checks requests against the module's zod schemas before a controller runs, and rejects unknown fields.
- `middlewares/rate-limit.ts` applies per-IP limits, tighter on the unauthenticated auth endpoints.
- `middlewares/request-context.ts` tags each request with an id, echoes it as `X-Request-Id`, and logs method, path, status and duration — never bodies or headers.
- `utils/reference-data.ts` provides reusable display values such as countries, cities, domain items, hierarchy names, and committee designations, read from the reference tables and cached in memory for an hour. Used by the `auth` and `member` controllers.
- `utils/jwt.ts` signs and verifies access and password-reset tokens.
- `utils/password.ts` hashes and verifies passwords.
- `utils/attempt-limiter.ts` throttles repeated login failures against one identity. IP limiting alone would not cover an attacker who changes address.
- `utils/roles.ts` derives an account's permission tier from the columns the live database actually populates.
- `utils/token-denylist.ts` supports logout and one-time reset-token invalidation.
- `utils/app-error.ts` represents expected application errors.
- `utils/response.ts` provides consistent success and error responses.
- `types/express.d.ts` adds authentication claims to Express request types.

## Database access

`src/db` is the only place that creates and exports the Prisma client. Controllers and shared utilities import it from there; they never construct their own.

The Prisma schema maps to the existing MySQL database, including `User`, `MembershipMaster`, `MembershipDetail`, `OrganisationUnit`, and reference-data models. Several models are intentionally partial representations of existing tables. Do not run `prisma migrate` or `prisma db push` against this database unless the schema strategy has been reviewed first.

## Architectural rules

- Each module contains only `<feature>.routes.ts`, `<feature>.controller.ts` and, where needed, `<feature>.validation.ts` (`auth` has routes and controller only); code shared between modules belongs in `utils/`.
- Routes only map HTTP methods and paths to middleware and controllers.
- Controllers own the feature's business logic and database queries.
- API code must use the shared Prisma client from `src/db`.
- Request bodies, query strings and route parameters are validated at the route boundary with zod schemas (from the module's `validation.ts`, or exported from `auth.controller.ts` for `auth`); the handlers themselves do not re-check request shape.
- Administrative routes must be gated by `require-role.ts`, never by a client-supplied role.
- Queries that read `users` must select an explicit column list, never the whole row.
- Protected endpoints must use `require-auth.ts`.
- Access tokens, reset tokens, and revoked tokens must remain distinct by token purpose.
- Sensitive values such as passwords and token secrets must never appear in API responses or logs.
- Changes to the existing database schema require explicit review because the Prisma models map an already populated MySQL database.