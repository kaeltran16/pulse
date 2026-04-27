import { describe, it, expect, vi } from "vitest";
import { pollAccountMessages, type ImapClient } from "../../src/worker/imap.js";

const FOURTEEN_DAYS_MS = 14 * 86_400_000;

function fakeClient(opts: {
  searchResult: number[];
  fetchOne: (uid: number) => {
    uid: number;
    envelope: { from: { address: string; name?: string }[]; subject: string; date: Date };
    source: Buffer;
  };
}): ImapClient {
  return {
    connect: vi.fn(async () => {}),
    mailboxOpen: vi.fn(async () => {}),
    search: vi.fn(async () => opts.searchResult),
    fetchOne: vi.fn(async (uid: number) => opts.fetchOne(uid)),
    logout: vi.fn(async () => {}),
  };
}

describe("pollAccountMessages", () => {
  it("uses UID range search when maxSeenUid is set", async () => {
    const client = fakeClient({
      searchResult: [101, 102],
      fetchOne: (uid) => ({
        uid,
        envelope: { from: [{ address: "alerts@chase.com" }], subject: `s${uid}`, date: new Date() },
        source: Buffer.from(""),
      }),
    });
    await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 100,
      now: Date.now(),
    });
    expect(client.search).toHaveBeenCalledWith({ uid: "101:*" });
  });

  it("uses date-range search when maxSeenUid is null (first poll)", async () => {
    const now = Date.now();
    const client = fakeClient({ searchResult: [], fetchOne: () => { throw new Error("unreachable"); } });
    await pollAccountMessages({ client, allowlist: ["chase.com"], maxSeenUid: null, now });
    expect(client.search).toHaveBeenCalledWith({
      since: new Date(now - FOURTEEN_DAYS_MS),
    });
  });

  it("filters out UIDs whose envelope.from is not in the allowlist", async () => {
    const client = fakeClient({
      searchResult: [1, 2, 3],
      fetchOne: (uid) => ({
        uid,
        envelope: {
          from: [{ address: uid === 2 ? "spam@unknown.com" : "alerts@chase.com" }],
          subject: `s${uid}`,
          date: new Date(),
        },
        source: Buffer.from(""),
      }),
    });
    const result = await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 0,
      now: Date.now(),
    });
    const uids = result.map((m) => m.uid);
    expect(uids).toEqual([1, 3]);
  });

  it("matches allowlist on full email and on domain suffix", async () => {
    const client = fakeClient({
      searchResult: [1, 2],
      fetchOne: (uid) => ({
        uid,
        envelope: {
          from: [{ address: uid === 1 ? "notify@chase.com" : "alerts@subdomain.chase.com" }],
          subject: `s${uid}`,
          date: new Date(),
        },
        source: Buffer.from(""),
      }),
    });
    const result = await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 0,
      now: Date.now(),
    });
    expect(result.map((m) => m.uid)).toEqual([1, 2]);
  });

  it("applies a 50-UID soft cap", async () => {
    const uids = Array.from({ length: 80 }, (_, i) => i + 1);
    const client = fakeClient({
      searchResult: uids,
      fetchOne: (uid) => ({
        uid,
        envelope: { from: [{ address: "alerts@chase.com" }], subject: `s${uid}`, date: new Date() },
        source: Buffer.from(""),
      }),
    });
    const result = await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 0,
      now: Date.now(),
    });
    expect(result).toHaveLength(50);
  });

  it("returns [] when search returns no UIDs", async () => {
    const client = fakeClient({ searchResult: [], fetchOne: () => { throw new Error("unreachable"); } });
    const result = await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 100,
      now: Date.now(),
    });
    expect(result).toEqual([]);
  });
});
