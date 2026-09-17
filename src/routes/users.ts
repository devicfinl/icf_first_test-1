import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { stringify } from "node:querystring";

export const usersRouter = Router();

const USER_FIELDS = [
  "userName",
  "password",
  "name",
  "memberNo",
  "orgId",
  "role",
  "defaultRole",
  "active",
  "isOfficeUser",
] as const;

const REQUIRED_FIELDS = USER_FIELDS.filter((field) => field !== "defaultRole");

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Copy only known user fields from the request body; Prisma validates their types.
function pickUserFields(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) return {};
  const source = body as Record<string, unknown>;
  return Object.fromEntries(
    USER_FIELDS.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]),
  );
}

// Prisma error codes: P2002 = unique constraint failed, P2025 = record not found.
function isPrismaError(err: unknown, code: string) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: "asc" }});
  res.json(users);
});

usersRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id.trim() === "") {
      res.status(400).json({ error: "Invalid id" });
      return;
    }


const user=  await prisma.user.findFirst({
    where: {
      memberNo: id,
    },
  });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



