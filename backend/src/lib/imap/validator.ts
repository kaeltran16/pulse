import { ImapFlow } from "imapflow";
import type { ImapValidator } from "../seedImapAccount.js";

// Production IMAP validator: opens a TLS connection to imap.gmail.com:993,
// authenticates with the provided creds, and logs out. Throws on auth failure
// (e.g., NO LOGIN / AUTHENTICATIONFAILED) and on network/TLS errors.
export const realImapValidator: ImapValidator = async ({ email, password }) => {
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
