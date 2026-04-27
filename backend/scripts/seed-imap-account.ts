// Run on the droplet via:
//   docker compose -f /opt/pulse/compose.yml run --rm -it worker \
//     node dist/backend/scripts/seed-imap-account.js \
//     --email <gmail> [--allowlist domain1,domain2]
//
// The Gmail app password is prompted on stdin (hidden). It is never passed
// as a CLI flag and never appears in shell history or `ps`.

import { ImapFlow } from "imapflow";
import { createDb } from "../src/db/client.js";
import { loadWorkerConfig } from "../src/config.js";
import { seedImapAccount, type ImapValidator } from "../src/lib/seedImapAccount.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function readPasswordHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stderr.write(prompt);
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      // Non-interactive (e.g., piped input) — fall back to plain readline.
      let buf = "";
      stdin.on("data", (chunk) => { buf += chunk.toString("utf8"); });
      stdin.on("end", () => resolve(buf.replace(/\r?\n$/, "")));
      stdin.on("error", reject);
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let out = "";
    const onData = (ch: string): void => {
      switch (ch) {
        case "": // Ctrl-C
          stdin.setRawMode(false);
          stdin.pause();
          process.stderr.write("\n");
          reject(new Error("aborted"));
          return;
        case "\r":
        case "\n":
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stderr.write("\n");
          resolve(out);
          return;
        case "": // Backspace
        case "\b":
          if (out.length > 0) out = out.slice(0, -1);
          return;
        default:
          if (ch.charCodeAt(0) >= 32) out += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const realValidator: ImapValidator = async ({ email, password }) => {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });
  await client.connect();
  await client.logout();
};

async function main(): Promise<void> {
  const email = arg("email");
  if (!email) {
    process.stderr.write("usage: seed-imap-account --email <gmail> [--allowlist domain1,domain2]\n");
    process.exit(2);
  }
  const allowlistRaw = arg("allowlist") ?? "";
  const allowlist = allowlistRaw
    ? allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  if (allowlist.length === 0) {
    process.stderr.write(
      "WARNING: --allowlist is empty. The worker will drop every email it sees.\n" +
        "         Edit later via `sqlite3 /opt/pulse/data/pulse.db` or re-run with --allowlist.\n",
    );
  }

  const password = await readPasswordHidden("Gmail app password: ");
  if (!password) {
    process.stderr.write("password is required\n");
    process.exit(2);
  }

  const config = loadWorkerConfig();
  const dbPath = process.env.DB_PATH ?? "/data/pulse.db";
  const { db } = createDb(dbPath);

  try {
    const { id } = await seedImapAccount(
      { db, encryptionKey: config.imapEncryptionKey, validator: realValidator, now: Date.now },
      { email, password, allowlist },
    );
    process.stderr.write(`seeded imap_accounts id=${id} email=${email}\n`);
    process.exit(0);
  } catch (err) {
    process.stderr.write(`seed failed: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
