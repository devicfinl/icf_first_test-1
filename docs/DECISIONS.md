Architecture Decisions

ADR-001

Decision: Use MySQL with Prisma as the ORM.

Reason: A relational database fits the structured application data such as members, committees, meetings, and other related entities. Prisma provides type-safe database access and a consistent data-access layer.

ADR-002

Decision: Use Node.js + Express for the backend rather than a full-stack framework.

Reason: The backend requires explicit control over routing, middleware, authentication, validation, and API structure.

ADR-003

Decision: Use a module-first folder structure with Controller → Service → Repository layers inside each module.

Reason: This combines feature-based organization with clear separation between HTTP handling, business logic, and database access. It also allows the application to scale as the number of modules increases.

ADR-004

Decision: Each module should have a plan.md file that describes the module's purpose, responsibilities, requirements, and implementation plan.

Reason: AI-assisted development should first understand the relevant module instead of analyzing the entire project for every small change. The module plan provides focused context while keeping the global architecture in ARCHITECTURE.md.

Rule: Before implementing or significantly modifying a module, inspect that module's plan.md and follow its documented requirements.

ADR-005

Decision: Use short-lived JWT access tokens for authentication.

Reason: The application requires stateless request authentication while keeping access-token exposure limited through a short lifetime.

Constraint: Do not introduce refresh tokens unless a new architecture decision explicitly approves them.

ADR-006

Decision: Store media files in external/cloud storage rather than in MySQL.

Reason: Binary files should not be stored directly in relational database tables. External object storage keeps the database smaller and separates structured application data from media assets.

ADR-007

Decision: Controllers must remain thin and business logic must belong to services.

Reason: Keeping HTTP concerns separate from business rules makes the application easier to test, maintain, and modify.

Rule:

Controllers handle HTTP input/output.

Services handle business logic.

Services must not construct HTTP responses.

ADR-008

Decision: Database access must be isolated in repositories.

Reason: Centralizing database access prevents controllers and services from becoming tightly coupled to Prisma and keeps persistence concerns separate from business logic.

Rule:

Controllers must not access Prisma directly.

Services should use repositories for database operations.

Do not create separate Prisma clients inside modules.

ADR-009

Decision: Request validation and business validation are separate responsibilities.

Reason: Request schemas should validate the structure and basic format of incoming data, while services must own business rules and database-dependent validation.

Rule:

Request
  ↓
Schema validation
  ↓
Controller
  ↓
Service
  ↓
Business validation
  ↓
Repository

Services may intentionally perform additional input checks even when route-level validation already exists.

ADR-010

Decision: Use centralized application error handling.

Reason: A consistent error-handling mechanism prevents every module from implementing its own HTTP error behavior.

Rule:

Service
  ↓
Application Error
  ↓
Controller error handling
  ↓
Global error handler/fallback

Services must not directly send HTTP responses.

ADR-011

Decision: Use a single shared Prisma/database client.

Reason: Multiple database clients can create unnecessary connection pools, inconsistent configuration, and difficult-to-manage database connections.

Rule: Database repositories must use the application's shared database client.

ADR-012

Decision: Query only the data required by the operation.

Reason: Retrieving complete tables or unnecessary columns increases database load, memory usage, response size, and processing overhead.

Rule:

Apply filtering at the database level.

Select only required columns where practical.

Do not retrieve an entire reference table when only specific IDs are required.

Do not fetch records that the current operation does not use.

ADR-013

Decision: Keep reference-data retrieval centralized and reusable.

Reason: Multiple modules require common reference data such as designations, countries, cities, units, and other lookup values. Centralizing this logic prevents duplicate database queries and inconsistent implementations.

Rule: Reuse the existing reference-data service instead of creating separate implementations inside individual modules.

ADR-014

Decision: Use caching only for relatively stable reference data.

Reason: Frequently accessed reference data does not need to be retrieved from the database on every request, while frequently changing transactional data should remain fresh.

Rule:

Cache only appropriate reference data.

Cache only the required records.

Define an explicit expiration/invalidation strategy.

Do not use caching as a replacement for correct database queries.

ADR-015

Decision: Keep authentication security state isolated from application business modules.

Reason: Authentication concerns such as token validation, revocation, login-attempt tracking, and rate limiting should not be duplicated across business modules.

Rule: Authentication-related middleware and utilities should remain centralized and reusable.

ADR-016

Decision: Preserve password-hash compatibility with existing systems.

Reason: The application must remain compatible with the existing authentication system.

Rule: Do not change the established password hashing/verification format without explicitly reviewing compatibility requirements and creating a new architecture decision.

ADR-017

Decision: Do not introduce role-based authorization unless it is explicitly required and approved.

Reason: Authorization must reflect the application's actual access model. Introducing roles prematurely creates unnecessary complexity and can conflict with the existing member/permission model.

Rule: Do not create roles, require-role, or similar authorization infrastructure unless a new architecture decision establishes it.

ADR-018

Decision: Keep frontend API communication behind a centralized API client.

Reason: Centralizing API communication provides a single place for authentication headers, error handling, session handling, and API configuration.

Rule: Frontend pages and components should not create independent HTTP clients for the same backend.

ADR-019

Decision: Keep authentication/session state separate from UI components.

Reason: Authentication state is application-level state and should not be duplicated across individual pages or components.

Rule: UI components should consume the existing authentication/session state rather than implementing their own authentication mechanism.

ADR-020

Decision: Preserve existing architecture when implementing small feature changes.

Reason: Small feature requests should not introduce new architectural patterns or unnecessary refactoring.

Rule:

Check whether an existing implementation already provides the required functionality.

Reuse the existing pattern when appropriate.

Introduce a new pattern only when the existing architecture cannot reasonably support the requirement.

Record significant architectural changes in DECISIONS.md.

ADR-021

Decision: Use ARCHITECTURE.md for system-level architecture and plan.md for module-level implementation context.

Reason: Global architecture and module-specific requirements have different scopes. Keeping them separate prevents ARCHITECTURE.md from becoming overloaded with feature-specific implementation details.

Rule:

ARCHITECTURE.md
    ↓
Global system architecture

Module/plan.md
    ↓
Module-specific requirements and implementation context

API.md
    ↓
API contracts and endpoints

DECISIONS.md
    ↓
Architectural decisions and their reasons

ADR-022

Decision: Do not modify database schema structure casually.

Reason: Database schema changes can affect existing data, applications, APIs, and deployments.

Rule: Any change to database schema, relationships, constraints, or mappings must be reviewed for compatibility before implementation.

ADR-023

Decision: Do not introduce a new dependency unless the existing stack cannot reasonably solve the requirement.

Reason: Additional dependencies increase maintenance, security, bundle size, and architectural complexity.

Rule: Before adding a package:

Check whether the project already has an equivalent capability.

Check whether the requirement can be implemented using existing dependencies.

Add a new dependency only when there is a clear technical reason.

ADR-024

Decision: Significant architectural changes require an architecture decision before implementation.

Reason: AI-assisted development can unintentionally introduce architectural changes while solving individual tasks.

Examples of changes requiring an ADR:

Changing authentication strategy

Introducing refresh tokens

Introducing role-based authorization

Changing database technology

Changing ORM

Changing module architecture

Changing database access patterns

Introducing a new state-management architecture

Introducing a new external infrastructure dependency

Moving security state from memory to a shared store

Small implementation changes do not require a new ADR.

ADR-025

Decision: AI coding agents must preserve existing architectural boundaries unless the task explicitly requires an architectural change.

Reason: AI-generated changes can easily introduce duplicate patterns, bypass existing layers, or modify unrelated parts of the system.

Rule:

Before implementing a task, the AI agent should:

Inspect the relevant module.

Read the module's plan.md when available.

Inspect existing implementations that solve similar problems.

Follow the established architecture.

Make the smallest appropriate change.

Avoid unrelated refactoring.

Create a new architectural decision when the requested change alters system architecture.