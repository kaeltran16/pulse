const FOURTEEN_DAYS_MS = 14 * 86_400_000;
const PER_TICK_UID_CAP = 50;

export type ImapEnvelope = {
  from: { address: string; name?: string }[];
  subject: string;
  date: Date;
};

export type FetchedMessage = {
  uid: number;
  envelope: ImapEnvelope;
  source: Buffer;
};

/**
 * Minimal subset of the imapflow client surface we use, so unit tests
 * can inject a fake. Maps directly onto `ImapFlow` instance methods.
 */
export type ImapClient = {
  connect: () => Promise<void>;
  mailboxOpen: (name: string) => Promise<unknown>;
  search: (
    query: { uid: string } | { since: Date },
  ) => Promise<number[] | undefined>;
  fetchOne: (uid: number, query: { source: true; envelope: true }) => Promise<{
    uid: number;
    envelope: ImapEnvelope;
    source: Buffer;
  }>;
  logout: () => Promise<void>;
};

function envelopeMatches(envelope: ImapEnvelope, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return false;
  const addr = (envelope.from?.[0]?.address ?? "").toLowerCase();
  return allowlist.some((entry) => {
    const e = entry.toLowerCase();
    return addr === e || addr.endsWith(`@${e}`) || addr.endsWith(`.${e}`);
  });
}

/**
 * One poll cycle for one connected IMAP client. Caller owns connect/logout
 * and the per-account credentials. Returns up to PER_TICK_UID_CAP messages.
 *
 * `maxSeenUid` null → date-range search (first-ever poll).
 * `maxSeenUid` number → UID-range search `${maxSeenUid + 1}:*`.
 */
export async function pollAccountMessages(args: {
  client: ImapClient;
  allowlist: readonly string[];
  maxSeenUid: number | null;
  now: number;
}): Promise<FetchedMessage[]> {
  const { client, allowlist, maxSeenUid, now } = args;
  const query =
    maxSeenUid == null
      ? { since: new Date(now - FOURTEEN_DAYS_MS) }
      : { uid: `${maxSeenUid + 1}:*` };
  const uids = (await client.search(query)) ?? [];
  if (uids.length === 0) return [];

  const out: FetchedMessage[] = [];
  for (const uid of uids) {
    if (out.length >= PER_TICK_UID_CAP) break;
    const msg = await client.fetchOne(uid, { source: true, envelope: true });
    if (!envelopeMatches(msg.envelope, allowlist)) continue;
    out.push({ uid: msg.uid, envelope: msg.envelope, source: msg.source });
  }
  return out;
}
