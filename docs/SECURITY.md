# Security Guidelines

## Purpose

This document defines the security requirements and constraints for this project.

Security must be considered when adding or modifying any feature.

## Security Principles

- Never expose secrets, passwords, tokens, or private keys.
- Never commit `.env` files or credentials.
- Never trust client-provided data.
- Validate all external input.
- Enforce authentication on protected resources.
- Enforce authorization where required.
- Use parameterized/database-safe queries.
- Do not bypass existing security middleware.
- Do not disable security checks to make a feature work.
- Do not expose internal errors or stack traces to clients.
- Do not log passwords, tokens, or sensitive personal information.

## Authentication

Follow the authentication architecture documented in `ARCHITECTURE.md`.

Do not introduce a different authentication mechanism without an architecture decision.

## Database Security

- Never construct unsafe SQL using untrusted input.
- Prefer Prisma's safe query APIs.
- Validate IDs and query parameters.
- Query only the data required.
- Never expose sensitive database fields unnecessarily.

## API Security

All API endpoints must consider:

- Authentication
- Authorization
- Input validation
- Rate limiting where appropriate
- CORS
- Error handling
- Sensitive-data exposure
- Resource ownership/access control

## File Upload Security

If file uploads are implemented:

- Validate file type
- Validate file size
- Do not trust the client-provided MIME type alone
- Use safe file names/paths
- Store files outside the application source directory
- Do not allow executable files unless explicitly required

## Dependency Security

Before adding a dependency:

1. Check whether an existing dependency already solves the problem.
2. Check whether the package is actively maintained.
3. Avoid unnecessary packages.
4. Do not install packages from untrusted sources.

## AI Coding Rules

Before modifying security-sensitive code, inspect:

- Authentication middleware
- Authorization logic
- Validation
- Database access
- Error handling
- Existing security utilities

Do not weaken existing security controls to solve a development problem.

Any significant security architecture change must be documented in `DECISIONS.md`.