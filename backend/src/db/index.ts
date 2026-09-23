// Database access shared by every app in the repo: the Prisma client and its models,
// plus connecting (through the SSH tunnel when SSH_HOST is set) and disconnecting.
export { connectDatabase, disconnectDatabase, prisma } from "./prisma.js";
export * from "./generated/prisma/client.js";
