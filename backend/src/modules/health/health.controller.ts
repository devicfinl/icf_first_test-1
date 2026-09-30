import type { Request, Response } from "express";
import { prisma } from "../../db/index.js";

// Deliberately not the { success, message, data } envelope the rest of the API uses: this is read
// by load balancers and uptime checks, which want a small, stable, flat body and a status code
// they can act on (200 healthy, 503 take me out of rotation).
export const health = async (_req: Request, res: Response) => {
  try {
    // Throws if the database can't be reached.
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      database: "connected",
      uptime_seconds: Math.floor(process.uptime()),
    });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({
      status: "error",
      database: "unreachable",
      uptime_seconds: Math.floor(process.uptime()),
    });
  }
};
