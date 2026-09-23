# Development Rules

## General
- Use consistent module structure: `routes → controller → service → repository`.
- Reuse existing utilities/middlewares — don't duplicate logic across modules.
- Keep functions small and single-purpose.
- Do not modify unrelated files/modules when implementing a feature.

## Before coding
- Read `docs/PRD.md`, `docs/ARCHITECTURE.md`, and this file.
- Check `prisma/schema.prisma` for existing models before adding new ones.
- For anything touching more than one module, write a short plan first.

## Backend
- Controllers: parse request, call service, return response. No business logic, no Prisma.
- Services: business rules and validation. Never import `@prisma/client` directly.
- Repositories: the only layer allowed to call `prisma.*`.
- Use the shared `prisma` instance from `src/config/db.js` — never `new PrismaClient()` elsewhere.
- Validate all request bodies/params before they reach the service layer.

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
