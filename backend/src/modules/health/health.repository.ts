import { prisma } from "../../db/index.js";

export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
