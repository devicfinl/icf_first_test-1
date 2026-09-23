# ICF Member Portal

A membership portal for ICF International: members sign in with their own membership number and
committee position instead of a shared organisation login.

## Layout

Two self-contained apps side by side. Each owns its dependencies, its `.env`, and its own
`node_modules` — there is no workspace hoisting, so either one can be built and deployed alone.

| Folder | What it is |
|---|---|
| `backend/` | Express 5 + Prisma REST API, and the Prisma client for the existing MySQL database |
| `frontend/` | React 19 + Vite single-page app |
| `docs/` | Product, architecture and process docs |

The root `package.json` is a convenience runner only. It has no dependencies of its own beyond
`concurrently` and does not manage the two apps' packages.

## Getting started

```bash
npm install            # the root runner (concurrently)
npm run setup          # installs backend/ and frontend/ dependencies
cp backend/.env.example backend/.env    # then fill in real values
npm run db:generate    # generate the Prisma client
npm run dev            # API on :3000, app on :5173
```

In development Vite proxies `/api` and `/health` to the API, so the browser only ever talks to one
origin and the API needs no CORS setup. Run one side on its own with `npm run dev:backend` or
`npm run dev:frontend`.

| Command | What it does |
|---|---|
| `npm run dev` | Both dev servers together |
| `npm run build` | Builds both apps |
| `npm test` | Backend test suite |
| `npm run typecheck` | Typechecks both apps |
| `npm run lint` | Lints the frontend |
| `npm run db:studio` | Prisma Studio against the database |

## Documentation

- `docs/API.md` — every endpoint, with request and response shapes
- `docs/PRD.md` — what we're building and why
- `docs/ARCHITECTURE.md` — how the system is structured
- `docs/DESIGN.md` — visual design system
- `docs/RULES.md` — development rules
- `docs/TASKS.md` — task breakdown by phase
- `docs/DECISIONS.md` — architecture decision records
- `docs/MEMORY.md` — current project state
- `docs/TEST_PLAN.md` — testing checklist
- `docs/SECURITY.md` — security requirements

> The database is an existing, populated MySQL instance and the Prisma schema maps only part of
> it, so do **not** run `prisma migrate` or `prisma db push` against it — that would drop the
> columns the schema does not mention.
