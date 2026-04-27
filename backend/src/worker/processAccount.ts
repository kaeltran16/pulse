import { createHash } from "node:crypto";
import { ZodError } from "zod";
import type { Db } from "../db/client.js";
import type { ImapAccount } from "../db/schema.js";
import * as imapAccountsQ from "../db/queries/imapAccounts.js";
import * as imapUidsQ from "../db/queries/imapUids.js";
import * as syncedEntriesQ from "../db/queries/syncedEntries.js";
import { decryptCredential } from "../lib/crypto/credentials.js";
import { extractPlaintext } from "../lib/email/extract.js";
import { parseEntry } from "../lib/parse.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";
import type { Logger } from "../lib/logger.js";
import { pollAccountMessages, type ImapClient } from "./imap.js";
import { isRecurring } from "./recurring.js";
import type { AccountBackoffState } from "./backoff.js";

const TRUNCATE_BYTES = 4096;

export type ImapClientFactory = (args: {
  host: string;
  port: number;
  secure: true;
  user: string;
  pass: string;
  logger?: Logger;
}) => ImapClient;

export type ProcessAccountDeps = {
  db: Db;
  account: ImapAccount;
  backoff: AccountBackoffState;
  logger: Logger;
  llm: LlmClient;
  modelId: string;
  encryptionKey: string;
  imapClientFactory: ImapClientFactory;
  now: number;
};

function isAuthFailure(err: unknown): boolean {
  if (err instanceof Error) {
    if ((err as Error & { authenticationFailed?: boolean }).authenticationFailed) return true;
    return /authenticationfailed|no\s+login|invalid credentials/i.test(err.message);
  }
  return false;
}

function parseAllowlist(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function processAccount(deps: ProcessAccountDeps): Promise<{
  inserted: number;
  skipped: number;
  hadTransientError: boolean;
}> {
  const { db, account, backoff, logger, llm, modelId, encryptionKey, imapClientFactory, now } = deps;

  // 1. Decrypt credentials. Permanent on failure.
  let appPassword: string;
  try {
    appPassword = decryptCredential(account.credentialsCiphertext, encryptionKey);
  } catch (err) {
    logger.error({ accountId: account.id, err: (err as Error).message }, "credential decrypt failed");
    imapAccountsQ.updateStatus(db, account.id, "error");
    imapAccountsQ.updateError(db, account.id, "credentials decrypt failed");
    return { inserted: 0, skipped: 0, hadTransientError: false };
  }

  const allowlist = parseAllowlist(account.senderAllowlist);
  if (allowlist.length === 0) {
    logger.warn({ accountId: account.id }, "empty senderAllowlist; nothing will be processed");
  }

  const client = imapClientFactory({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    user: account.emailAddress,
    pass: appPassword,
    logger,
  });

  // 2. Connect. Auth failures are permanent; everything else is transient.
  try {
    await client.connect();
  } catch (err) {
    if (isAuthFailure(err)) {
      logger.error({ accountId: account.id, err: (err as Error).message }, "imap auth failed");
      imapAccountsQ.updateStatus(db, account.id, "error");
      imapAccountsQ.updateError(db, account.id, `auth failure: ${(err as Error).message}`);
      return { inserted: 0, skipped: 0, hadTransientError: false };
    }
    logger.warn({ accountId: account.id, err: (err as Error).message }, "imap connect failed (transient)");
    backoff.recordTransientFailure(account);
    return { inserted: 0, skipped: 0, hadTransientError: true };
  }

  let inserted = 0;
  let skipped = 0;
  let tickError = false;

  try {
    await client.mailboxOpen("INBOX");

    // 3. high-water-mark UID lookup
    const seenUids = imapUidsQ.listSeenUidsForAccount(db, account.id);
    const maxSeenUid = seenUids.length === 0 ? null : Math.max(...seenUids);

    // 4 + 5. Search + fetch (handled by pollAccountMessages)
    const messages = await pollAccountMessages({ client, allowlist, maxSeenUid, now });

    for (const msg of messages) {
      const plaintext = await extractPlaintext(msg.source);
      const truncated = plaintext.slice(0, TRUNCATE_BYTES);
      const text = `Subject: ${msg.envelope.subject}\n\n${truncated}`;
      const contentHash = createHash("sha256")
        .update(`${msg.envelope.subject}\n${plaintext}`)
        .digest("hex");

      let parsed;
      try {
        parsed = await parseEntry({ llm, modelId, logger }, { text, hint: "spend" });
      } catch (err) {
        if (err instanceof UpstreamError) {
          logger.warn({ accountId: account.id, uid: msg.uid, err: err.message }, "parseEntry upstream error; aborting tick");
          tickError = true;
          break;
        }
        if (err instanceof ZodError) {
          logger.warn({ accountId: account.id, uid: msg.uid }, "parseEntry schema failure; marking UID seen");
          imapUidsQ.markUidSeen(db, account.id, msg.uid, now);
          skipped++;
          continue;
        }
        throw err;
      }

      if (parsed.kind === "workout" || parsed.kind === "chat") {
        logger.info({ accountId: account.id, uid: msg.uid, kind: parsed.kind }, "skipped non-spend email");
        imapUidsQ.markUidSeen(db, account.id, msg.uid, now);
        skipped++;
        continue;
      }

      // kind === 'spend'
      const cents = Math.round(parsed.data.amount * 100);
      const currency = parsed.data.currency;
      const merchant = parsed.data.merchant ?? null;
      const occurredAt = msg.envelope.date.getTime();
      const priors = merchant
        ? syncedEntriesQ.findRecurringCandidates(db, account.id, merchant, occurredAt)
        : [];
      const recurring = isRecurring(priors, { cents, currency }) ? 1 : 0;

      // Single transaction: insert the synced entry + mark the UID seen together.
      // Drizzle's `db.transaction` is synchronous for better-sqlite3; the callback
      // receives a transaction-scoped Db instance.
      db.transaction((tx) => {
        const txDb = tx as unknown as Db;
        syncedEntriesQ.insertSyncedEntry(txDb, {
          accountId: account.id,
          imapUid: msg.uid,
          contentHash,
          cents,
          currency,
          merchant,
          category: parsed.data.category ?? null,
          occurredAt,
          recurring,
          rawParseResponse: JSON.stringify(parsed),
          emailSubject: msg.envelope.subject,
          emailFrom: msg.envelope.from?.[0]?.address ?? null,
          createdAt: now,
        });
        imapUidsQ.markUidSeen(txDb, account.id, msg.uid, now);
      });
      inserted++;
    }
  } catch (err) {
    logger.warn({ accountId: account.id, err: (err as Error).message }, "imap tick failed (transient)");
    tickError = true;
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }

  // 6. Bookkeeping
  imapAccountsQ.updateLastPolled(db, account.id, now);
  if (tickError) {
    backoff.recordTransientFailure(account);
  } else {
    backoff.recordSuccess(account);
    imapAccountsQ.updateError(db, account.id, null);
  }

  return { inserted, skipped, hadTransientError: tickError };
}
