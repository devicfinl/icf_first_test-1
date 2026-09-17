import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./lib/prisma.js";

const port = Number(process.env.PORT) || 3000;

try {
  await connectDatabase();
} catch (err) {
  console.error("Database connection failed. Check DATABASE_URL and SSH_* settings in .env.");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
