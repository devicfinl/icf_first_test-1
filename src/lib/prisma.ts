import "dotenv/config";
import type { Server } from "node:net";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import mariadb from "mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
import { openSshTunnel } from "./ssh-tunnel.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Reuse the same DATABASE_URL that Prisma migrations use (mysql://user:pass@host:port/db).
const url = new URL(databaseUrl);

const connectionConfig = {
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  // Needed for MySQL 8+ default auth (caching_sha2_password) without TLS.
  allowPublicKeyRetrieval: true,
  // The driver's 1s default is too short over an SSH tunnel, especially when the pool opens several connections at once.
  connectTimeout: 10_000,
};

// The pool connects lazily, so nothing is opened until the first query (after connectDatabase).
const adapter = new PrismaMariaDb({ ...connectionConfig, connectionLimit: 10 });

export const prisma = new PrismaClient({ adapter });

const databaseLabel = `${url.hostname}:${connectionConfig.port}/${connectionConfig.database}`;

let tunnel: Server | null = null;

export async function connectDatabase() {
  // When SSH_HOST is set, DATABASE_URL's host:port is the local end of the tunnel.
  tunnel = await openSshTunnel(connectionConfig.host, connectionConfig.port);

  // Check with a single direct connection: a failing pool only reports a generic "pool timeout"
  // after 10s, while a direct connection fails immediately with MySQL's real error (e.g. Access denied).
  const connection = await mariadb.createConnection(connectionConfig);
  await connection.end();
  console.log(`Database connected (${databaseLabel})`);
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  tunnel?.close();
}
