import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./db/index.js";
import { env } from "./config/env.js";

// How long a shutdown waits for in-flight requests before giving up. Without a deadline a single
// hung connection keeps the process alive and the orchestrator ends up killing it anyway.
const SHUTDOWN_TIMEOUT_MS = 10_000;

try {
  await connectDatabase();
} catch (err) {
  console.error("Database connection failed. Check DATABASE_URL and SSH_* settings in .env.");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const server = app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0) {
  // A second Ctrl-C (or SIGTERM followed by SIGINT) should not start a second teardown.
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received, shutting down...`);

  // Stop accepting new connections, then wait for the open ones — but not forever.
  const closed = new Promise<void>((resolve) => server.close(() => resolve()));
  const timedOut = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS).unref(),
  );

  if ((await Promise.race([closed, timedOut])) === "timeout") {
    console.warn(`Requests still in flight after ${SHUTDOWN_TIMEOUT_MS}ms; closing anyway.`);
    server.closeAllConnections();
  }

  try {
    await disconnectDatabase();
  } catch (err) {
    console.error("Error while closing the database connection:", err);
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// The process is in an unknown state after either of these, so it is drained and replaced rather
// than left running. Logging them is what makes the difference between a mystery restart and a bug
// with a stack trace.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  void shutdown("uncaughtException", 1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  void shutdown("unhandledRejection", 1);
});
