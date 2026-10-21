// Runs sql/migrate-pv-subscriptions.sql (legacy vayana_master_single -> pv_subscription_master
// + pv_subscription_details). A dry run unless --commit is given, which sets @pv_commit = 1
// for the SQL file. No backup is taken: the file empties and reloads both tables.
//
//   npm run db:migrate:pv-subscriptions          (from backend/) dry run
//   npm run db:migrate:pv-subscriptions:commit
//    (from backend/) keeps the data if every check passes
//
// Connects with DATABASE_URL from backend/.env, the same way the app does: when SSH_HOST is set,
// it opens the app's SSH tunnel (src/db/ssh-tunnel.ts), or uses the one already open on
// DATABASE_URL's host:port (e.g. while `npm run dev` is running). Needs the mysql client. The
// password is passed in a temporary options file (mode 600), not on the command line.

import { spawn } from "node:child_process";
import { mkdtempSync, openSync, closeSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backend = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = "migrate-pv-subscriptions.sql";
const commit = process.argv.slice(2).includes("--commit");
const migration = join(backend, "sql", file);

// Set once the options file exists; removed on every exit, including a failure.
let optionsDir = null;

function fail(message) {
  if (optionsDir) rmSync(optionsDir, { recursive: true, force: true });
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set in backend/.env.");

const url = new URL(process.env.DATABASE_URL);
const host = url.hostname;
const port = Number(url.port) || 3306;
const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!database) fail("DATABASE_URL has no database name.");

// True when something already accepts connections on host:port.
function isListening() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(2000);
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("timeout", () => (socket.destroy(), resolve(false)));
    socket.once("error", () => resolve(false));
  });
}

// With SSH_HOST set, DATABASE_URL's host:port is the local end of the tunnel.
let tunnel = null;
if (process.env.SSH_HOST) {
  if (await isListening()) {
    console.log(`Using the SSH tunnel already open on ${host}:${port}.`);
  } else {
    try {
      const { openSshTunnel } = await import("../src/db/ssh-tunnel.ts");
      tunnel = await openSshTunnel(host, port);
    } catch (error) {
      fail(`Could not open the SSH tunnel: ${error.message}`);
    }
  }
}

// Credentials go in an options file so they never show up in `ps` or shell history.
// protocol=TCP: with host=localhost the clients would otherwise try a local socket file.
optionsDir = mkdtempSync(join(tmpdir(), "pv-subscriptions-"));
const options = join(optionsDir, "my.cnf");
writeFileSync(
  options,
  [
    "[client]",
    `host=${host}`,
    `port=${port}`,
    "protocol=TCP",
    `user=${decodeURIComponent(url.username)}`,
    `password="${decodeURIComponent(url.password).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);

// Runs a client with the options file; stdin can be read from a file. Asynchronous,
// so the in-process SSH tunnel keeps forwarding while the client runs.
async function run(step, command, args, { input } = {}) {
  console.log(`\n▶ ${step}`);
  const stdin = input ? openSync(input, "r") : "inherit";
  const result = await new Promise((resolve) => {
    const child = spawn(command, [`--defaults-extra-file=${options}`, ...args], { stdio: [stdin, "inherit", "inherit"] });
    child.once("error", (error) => resolve({ error }));
    child.once("close", (status) => resolve({ status }));
  });
  if (typeof stdin === "number") closeSync(stdin);

  if (result.error) fail(`${step} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${step} failed (exit ${result.status}). Nothing after it was run.`);
}

try {
  const mode = commit ? ["--init-command=SET @pv_commit = 1"] : [];
  await run(`Run ${file}${commit ? " (commit)" : ""}`, "mysql", ["--table", ...mode, database], { input: migration });

  console.log("\n✔ Done. Check the numbers printed by the migration above.");
} finally {
  rmSync(optionsDir, { recursive: true, force: true });
  tunnel?.close();
}
