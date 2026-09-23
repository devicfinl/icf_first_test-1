# Security Requirements

## Authentication
- All member/admin routes require a valid JWT access token.
- Passwords are hashed with bcrypt (never stored in plain text).

## Authorization
- Role checks (`SUPER_ADMIN`, `ADMIN`, `MEMBER`, `GUEST`) are enforced server-side via `middlewares/role.js`, never trusted from the client.
- Users can only modify their own profile/membership; admin routes are separate and role-gated.

## Secrets
- No API keys, JWT secrets, or DB credentials in source code — use `.env` (gitignored) and `.env.example` for documentation only.

## Database
- Use parameterized queries via Prisma (default) — never raw string-concatenated SQL.
- Apply least-privilege DB credentials for the app's MySQL user.

## Input validation
- Validate and sanitize all request bodies/params (e.g. via a validation library) before they reach the service layer.
- Reject unexpected fields on write endpoints.

## File uploads (Gallery)
- Validate file type (images/video only) and size before upload.
- Generate safe, unique filenames — never trust the client-provided filename directly.
- Upload directly to cloud storage; never save uploaded files to the app server's disk.

## Transport
- Enforce HTTPS in production.
- Set secure, httpOnly cookies if refresh tokens are stored in cookies.
