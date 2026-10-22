// One command per Pravasi Vayana targets migration: back up the table it changes, run the
// SQL file, then show the first rows of the targets table. Stops at the first failure.
//
//   npm run db:migrate:pv-targets        (from backend/) pv-targets.sql
//
// Arguments: <file in backend/sql/> <table to back up first>.
//
// Connects with DATABASE_URL from backend/.env, the same way the app does: when SSH_HOST is set,
// it opens the app's SSH tunnel (src/db/ssh-tunnel.ts), or uses the one already open on
// DATABASE_URL's host:port (e.g. while `npm run dev` is running). Needs the mysql and mysqldump
// clients. The password is passed in a temporary options file (mode 600), not on the command line.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, closeSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backend = join(dirname(fileURLToPath(import.meta.url)), "..");
const [file, backupTable] = process.argv.slice(2);
if (!file || !backupTable) {
  console.error("Usage: migrate-pv-targets.mjs <file in backend/sql/> <table to back up first>");
  process.exit(1);
}
const migration = join(backend, "sql", file);
const backups = join(backend, "sql", "backups");

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
optionsDir = mkdtempSync(join(tmpdir(), "pv-targets-"));
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

// Runs a client with the options file; stdin / stdout can be redirected to files. Asynchronous,
// so the in-process SSH tunnel keeps forwarding while the client runs.
async function run(step, command, args, { input, output } = {}) {
  console.log(`\n▶ ${step}`);
  const stdin = input ? openSync(input, "r") : "inherit";
  const stdout = output ? openSync(output, "w") : "inherit";
  const result = await new Promise((resolve) => {
    const child = spawn(command, [`--defaults-extra-file=${options}`, ...args], { stdio: [stdin, stdout, "inherit"] });
    child.once("error", (error) => resolve({ error }));
    child.once("close", (status) => resolve({ status }));
  });
  if (typeof stdin === "number") closeSync(stdin);
  if (typeof stdout === "number") closeSync(stdout);

  if (result.error) fail(`${step} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${step} failed (exit ${result.status}). Nothing after it was run.`);
}

try {
  mkdirSync(backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = join(backups, `${backupTable}-${stamp}.sql`);

  await run(
    `1/3 Back up ${backupTable}`,
    "mysqldump",
    ["--single-transaction", "--set-gtid-purged=OFF", database, backupTable],
    { output: backup },
  );
  // mysqldump can print an error and still exit 0, so the file itself is checked.
  if (!readFileSync(backup, "utf8").includes(`CREATE TABLE \`${backupTable}\``)) {
    fail(`The backup ${backup} has no table definition. Nothing after it was run.`);
  }
  console.log(`  saved ${backup}`);

  await run(`2/3 Run ${file}`, "mysql", ["--table", database], { input: migration });

  await run("3/3 First rows of the targets table", "mysql", ["--table", database, "-e", "SELECT * FROM pv_subscription_entity LIMIT 10;"]);

  console.log("\n✔ Done. Check the numbers printed by the migration above.");
} finally {
  rmSync(optionsDir, { recursive: true, force: true });
  tunnel?.close();
}
