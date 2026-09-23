# Architecture Decisions

## ADR-001
**Decision:** Use MySQL with Prisma as the ORM.
**Reason:** Familiar relational model for structured club data (members, events, posts); Prisma gives type-safe queries and easy migrations.

## ADR-002
**Decision:** Use Node.js + Express for the backend rather than a full-stack framework.
**Reason:** Team is starting backend-first and wants explicit control over routing, middleware, and API structure.

## ADR-003
**Decision:** Module-first folder structure with Controller → Service → Repository layers inside each module.
**Reason:** Combines the architectural discipline of a layered app (clear separation of HTTP/business logic/DB access) with the organizational clarity of feature folders, which scales better past ~5 modules than a flat layer-first structure.


## ADR-004
**Decision:** read plan.md file in for each module folder and think and implemnet 
**Reason:** this more simple to reduce anazile entire folder need only the check that modul file


## ADR-005
**Decision:** JWT-based auth with short-lived access tokens + refresh tokens.
**Reason:** Stateless auth that scales easily; refresh tokens allow session renewal without forcing frequent re-logins.

## ADR-006
**Decision:** Store media files in cloud storage (S3), not in MySQL.
**Reason:** Keeps the database lean and fast; binary blobs in MySQL hurt query performance and backup size.
