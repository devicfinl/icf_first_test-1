# mock-icf-ifrt

Express 5 + TypeScript API backed by MySQL, using Prisma 7 for the client and migrations.

## Setup

1. Install dependencies:
   ```sh
   npm install
   ```
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to your MySQL credentials:
   ```
   DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/mock_icf_ifrt"
   ```
   URL-encode special characters in the password (for example, `@` becomes `%40`).
3. Create the database and apply migrations (this also generates the Prisma client):
   ```sh
   npm run db:migrate -- --name init
   ```
4. Start the dev server:
   ```sh
   npm run dev
   ```

## Scripts

| Script                | Description                                         |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | Run with auto-reload (tsx)                          |
| `npm run build`       | Generate Prisma client and compile to `dist/`       |
| `npm start`           | Run the compiled server                             |
| `npm run typecheck`   | Type-check without emitting                         |
| `npm run db:migrate`  | Create and apply a migration from schema changes    |
| `npm run db:deploy`   | Apply pending migrations (production/CI)            |
| `npm run db:generate` | Regenerate the Prisma client                        |
| `npm run db:studio`   | Open Prisma Studio                                  |

## Remote database over SSH

When `SSH_HOST` is set in `.env`, the server opens an SSH tunnel before connecting to MySQL.
`DATABASE_URL` must then point at the local end of the tunnel, for example
`mysql://user:password@127.0.0.1:3307/dbname`. See `.env.example` for the `SSH_*` settings.

Prisma CLI commands (`db:migrate`, `db:studio`, `prisma db pull`) don't open the tunnel themselves.
Stop `npm run dev` (it uses the same local port), then open the tunnel in another terminal:

```sh
ssh -N -L 3307:127.0.0.1:3306 your-ssh-user@your-server-ip
```

Don't run `npm run db:migrate` against a shared database that already has tables: Prisma will ask to
reset it, which deletes all data. Use `npx prisma db pull` to copy the existing tables into the schema instead.

## Changing the schema

Edit `prisma/schema.prisma`, then run `npm run db:migrate -- --name <change-name>`.
Migration files are written to `prisma/migrations/` and should be committed.

## Authentication

`POST /api/auth/member-login` returns a JWT that expires after 15 minutes. Send it on protected routes as
`Authorization: Bearer <token>`. The `requireAuth` middleware (`src/middleware/require-auth.ts`) rejects missing,
malformed, expired and revoked tokens; add it to any route that needs a logged-in caller.

`POST /api/auth/logout` revokes the caller's token until it would have expired. The revoked list is held in memory
(`src/lib/token-denylist.ts`), so revocations are lost on restart and are not shared between processes. Move it to
Redis or a database table before running more than one instance.

## Password reset OTP

`POST /api/auth/member-forgot-password` checks the membership number and mobile number against
`membership_master`, then generates a six-digit code that expires after 10 minutes.

`POST /api/auth/member-verify-otp` checks that code. A code allows 5 tries and is thrown away once it is
used or those tries run out, so a guessed code can't be hammered. A correct code returns a `reset_token`
that is valid for 10 minutes and authorises only the password change step: it carries
`purpose: "password_reset"`, and `requireAuth` accepts session tokens (`purpose: "access"`) only.

`POST /api/auth/member-reset-password` takes that `resetToken` plus `password` and `confirmPassword`
(at least 8 characters, and the two must match), writes the new password to `users.password`, and
revokes the reset token so it can't be used twice. Passwords are stored as bcrypt hashes with the
`$2y$` prefix, so the PHP app can still verify them.

Two things must change before this goes to production:

- **The code is returned in the response** (`data.otp`), because no SMS provider is wired up yet.
  Anyone who knows a membership number and mobile number can read it. Send it by SMS and drop it
  from the response instead — see the TODO in `src/controllers/auth.controller.ts`.
- **Codes are kept in memory** (`src/lib/otp.ts`), because this database has no `membership_otp`
  table. They are lost on restart and not shared between processes.

## Endpoints

| Method | Path             | Description                                     |
| ------ | ---------------- | ----------------------------------------------- |
| GET    | `/health`        | Server and database check                       |
| POST   | `/api/auth/member-login` | Log in with `user_name` or `mobile_country` + `mobile`, plus `password`; returns a 15-minute JWT |
| POST   | `/api/auth/logout` | Revoke the caller's token; needs `Authorization: Bearer <token>` |
| POST   | `/api/auth/member-forgot-password` | Send an OTP for `membership_no` + `mobile_country` + `mobile` |
| POST   | `/api/auth/member-verify-otp` | Verify `membershipNo` + `otp`; returns a 10-minute reset token |
| POST   | `/api/auth/member-reset-password` | Set a new password with `resetToken` + `password` + `confirmPassword` |
| GET    | `/api/users`     | List users                                      |
| GET    | `/api/users/:id` | Get a user                                      |
| POST   | `/api/users`     | Create a user (see body below)                  |
| PUT    | `/api/users/:id` | Update a user (any subset of the body fields)   |
| DELETE | `/api/users/:id` | Delete a user                                   |

User body fields: `userName`, `password`, `name`, `memberNo`, `role` (strings);
`orgId`, `active`, `isOfficeUser` (integers); `defaultRole` (integer, optional).
All fields except `defaultRole` are required on create. `password` is never returned in responses.
