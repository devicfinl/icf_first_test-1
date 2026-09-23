import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// The repo keeps a single .env at its root; Prisma CLI commands run from this package.
config({ path: new URL(".env", import.meta.url), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
