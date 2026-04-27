import type { Db } from "../db/client.js";
import * as imapAccountsQ from "../db/queries/imapAccounts.js";
import { encryptCredential } from "./crypto/credentials.js";

export type ImapValidator = (args: { email: string; password: string }) => Promise<void>;

export type SeedDeps = {
  db: Db;
  encryptionKey: string;
  validator: ImapValidator;
  now: () => number;
};

export type SeedInput = {
  email: string;
  password: string;
  allowlist: readonly string[];
};

/**
 * Validates the IMAP credentials against Gmail BEFORE persisting (so the user
 * finds out about a wrong app password now, not on the first poll). On success,
 * encrypts the password and inserts a row into `imap_accounts`.
 *
 * Throws if:
 *   - validator rejects (e.g., IMAP NO LOGIN)
 *   - email already exists in imap_accounts (UNIQUE constraint)
 */
export async function seedImapAccount(
  deps: SeedDeps,
  input: SeedInput,
): Promise<{ id: number }> {
  await deps.validator({ email: input.email, password: input.password });
  const ciphertext = encryptCredential(input.password, deps.encryptionKey);
  const now = deps.now();
  try {
    return imapAccountsQ.createImapAccount(deps.db, {
      emailAddress: input.email,
      credentialsCiphertext: ciphertext,
      senderAllowlist: JSON.stringify([...input.allowlist]),
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (/UNIQUE/i.test(msg)) {
      throw new Error(`account ${input.email} already exists`);
    }
    throw err;
  }
}
