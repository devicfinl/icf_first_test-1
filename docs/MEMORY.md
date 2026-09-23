# Project Memory

## Current Status
The repository is two self-contained apps: `backend/` (Express 5 + Prisma, module-first
Controller-Service-Repository) and `frontend/` (React 19 + Vite + Redux Toolkit). They are
connected end to end — the app signs in against the real API, holds a bearer token, and renders a
member's profile. The backend has 84 passing tests.

## Completed
- Repo restructured from an npm-workspaces monorepo into `backend/` + `frontend/`; the Prisma
  package folded into `backend/src/db`, and `apps/` removed
- Full member auth: login, committee position selection, profile, change password, forgot/reset
  password, logout with token revocation
- Request validation with zod at the route boundary, rejecting unknown fields
- One error taxonomy across every module (400/401/403/404/429)
- Security: role-gated admin routes, helmet, CORS allowlist, body size limit, per-IP rate limiting,
  per-account lockout, request ids, graceful shutdown
- Frontend wired to the API: bearer token, 401 handling, session persistence, route guard that
  routes through position selection

## Known Issues
- The token denylist and the attempt limiter are in-memory, so they are per-process and reset on
  restart. They need Redis or a table before the API runs as more than one instance.
- `users.role` is empty on all 1,887 rows bar one, so the PRD's four permission tiers are not in
  the data yet. Admin access currently falls back to the legacy `users.is_office_user` flag.
- Member profile is read-only; no write endpoint touches `membership_master` yet.
- Cloud storage provider (S3 vs Cloudinary) not yet chosen.
- Prisma models map an existing MySQL database; schema changes require review before any migration
  or database push.

## Next Step
Build out the MVP modules that still have no backend at all — events, news/blog, gallery, contact.
These need new tables, so the schema strategy has to be agreed first: the current database is live
and the Prisma schema maps it only partially. Do not run `prisma migrate dev` or `prisma db push`
against it without that review.
