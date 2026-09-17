import express, { type ErrorRequestHandler } from "express";
import { prisma } from "./lib/prisma.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";

export const app = express();

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Express 5 forwards rejected promises from async handlers here automatically.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);
