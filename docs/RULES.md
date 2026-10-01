# Development Rules

## General
- Use consistent module structure: `<feature>.routes.ts`, `<feature>.controller.ts` and, where the endpoints take input, `<feature>.validation.ts` (see `docs/ARCHITECTURE.md`).
- Reuse existing utilities/middlewares — don't duplicate logic across modules.
- Keep functions small and single-purpose.
- Do not modify unrelated files/modules when implementing a feature.

## Before coding
- Read `docs/PRD.md`, `docs/ARCHITECTURE.md`, and this file.
- Check `prisma/schema.prisma` for existing models before adding new ones.
- For anything touching more than one module, write a short plan first.

## Backend
- Routes: map HTTP methods and paths to middleware and controllers. Nothing else.
- Controllers: business rules, database queries and the response for their feature.
- Code used by more than one module goes in `src/utils/`, not in another module's folder.
- Use the shared `prisma` instance from `src/db` — never `new PrismaClient()` elsewhere.
- Validate all request bodies/params with zod at the route, before they reach the controller.

## Security
- Never commit `.env` or real API keys — only `.env.example` goes into Git.
- Verify authentication and role/authorization server-side on every protected route.
- Validate file type and size on all uploads (gallery media).

## Testing
- Add tests for auth, membership, and event registration at minimum.
- Run tests after implementing each module before moving to the next.
- Fix failing tests before starting new work.

## Git
- Small, focused commits with descriptive messages (e.g. `feat: add event registration`).
- One module/feature per branch where practical.
