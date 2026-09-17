import fs from "node:fs";
import net, { type Server } from "node:net";
import os from "node:os";
import ssh2, { type Client, type ConnectConfig } from "ssh2";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (required when SSH_HOST is set)`);
  }
  return value;
}

// Forwards localHost:localPort to MySQL on the SSH server. Returns null when SSH_HOST is not set.
// The SSH session is reopened on demand after it drops, and a connection that can't be forwarded
// is closed right away, so database calls fail fast instead of hanging on a dead tunnel.
export async function openSshTunnel(localHost: string, localPort: number): Promise<Server | null> {
  const sshHost = process.env.SSH_HOST;
  if (!sshHost) return null;

  const sshUser = requireEnv("SSH_USER");
  const keyPath = requireEnv("SSH_PRIVATE_KEY_PATH").replace(/^~(?=\/|$)/, os.homedir());
  const dbHost = process.env.SSH_DB_HOST || "127.0.0.1";
  const dbPort = Number(process.env.SSH_DB_PORT) || 3306;
  const label = `${localHost}:${localPort} -> ${sshUser}@${sshHost} -> ${dbHost}:${dbPort}`;

  const sshConfig: ConnectConfig = {
    host: sshHost,
    port: Number(process.env.SSH_PORT) || 22,
    username: sshUser,
    privateKey: fs.readFileSync(keyPath),
    passphrase: process.env.SSH_PASSPHRASE || undefined,
    readyTimeout: 10_000,
    // Detect a silently dropped connection (e.g. after sleep or a network change) within ~45s.
    keepaliveInterval: 15_000,
    keepaliveCountMax: 3,
  };

  let session: Promise<Client> | null = null;
  let hasConnected = false;
  let closing = false;

  function getSession(): Promise<Client> {
    if (session) return session;

    const attempt = new Promise<Client>((resolve, reject) => {
      const client = new ssh2.Client();
      client
        .on("ready", () => {
          if (hasConnected) console.log(`SSH tunnel reconnected (${label})`);
          hasConnected = true;
          resolve(client);
        })
        .on("error", (err) => {
          if (!closing) console.error(`SSH tunnel error: ${err.message}`);
          if (session === attempt) session = null;
          reject(err);
        })
        .on("close", () => {
          if (session === attempt) {
            session = null;
            if (!closing) console.warn("SSH tunnel disconnected; reconnecting on the next database connection");
          }
          reject(new Error("SSH connection closed"));
        })
        .connect(sshConfig);
    });

    session = attempt;
    return attempt;
  }

  const server = net.createServer(async (socket) => {
    socket.on("error", () => socket.destroy());
    try {
      const client = await getSession();
      client.forwardOut(localHost, localPort, dbHost, dbPort, (err, channel) => {
        if (err || socket.destroyed) {
          if (err) console.error(`SSH tunnel forward failed: ${err.message}`);
          channel?.destroy();
          socket.destroy();
          return;
        }
        channel.on("error", () => socket.destroy()).on("close", () => socket.destroy());
        socket.on("close", () => channel.destroy());
        socket.pipe(channel).pipe(socket);
      });
    } catch {
      socket.destroy();
    }
  });

  // Connect once up front so SSH problems (bad key, wrong host) fail startup with a clear error.
  await getSession();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(localPort, localHost, () => {
      server.off("error", reject);
      resolve();
    });
  });

  server.on("close", () => {
    closing = true;
    session?.then((client) => client.end(), () => {});
  });

  console.log(`SSH tunnel open (${label})`);
  return server;
}
