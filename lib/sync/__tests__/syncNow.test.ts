/** @jest-environment node */
import { makeTestDb } from '../../db/__tests__/test-helpers';
import { syncNow, __resetInflightForTests } from '../syncNow';
import * as client from '../client';

const sample = (id: number, opts: { recurring?: boolean } = {}) => ({
  id,
  merchant: 'M',
  cents: 100 * id,
  currency: 'USD',
  category: 'Food',
  occurredAt: 1_700_000_000_000 + id,
  recurring: opts.recurring ?? false,
  emailFrom: 'a@b',
});

const connectedStatus = (overrides: Partial<{ status: 'active' | 'paused' | 'error' }> = {}) => ({
  connected: true as const,
  accountId: 7,
  emailAddress: 'a@gmail.com',
  status: (overrides.status ?? 'active') as 'active' | 'paused' | 'error',
  lastPolledAt: null,
  lastError: null,
  pollIntervalSeconds: 300,
  senderAllowlist: [],
});

describe('syncNow', () => {
  beforeEach(() => {
    __resetInflightForTests();
    jest.restoreAllMocks();
  });

  it('disconnected → no-op', async () => {
    const { db } = makeTestDb();
    jest.spyOn(client, 'imapStatus').mockResolvedValue({ connected: false });
    const r = await syncNow(db);
    expect(r).toEqual({ inserted: 0, status: 'disconnected' });
  });

  it('first sync inserts rows + advances cursor', async () => {
    const { db, raw } = makeTestDb();
    jest.spyOn(client, 'imapStatus').mockResolvedValue(connectedStatus());
    jest.spyOn(client, 'fetchSyncEntries').mockResolvedValueOnce({
      accountId: 7,
      entries: [sample(1), sample(2)],
      hasMore: false,
      cursor: 2,
    });
    const r = await syncNow(db);
    expect(r).toEqual({ inserted: 2, status: 'connected' });
    const rows = raw
      .prepare('SELECT synced_entry_id FROM spending_entries ORDER BY synced_entry_id')
      .all() as Array<{ synced_entry_id: number }>;
    expect(rows.map((r) => r.synced_entry_id)).toEqual([1, 2]);
    const cursor = raw
      .prepare('SELECT account_id, last_synced_id FROM sync_cursor')
      .get() as { account_id: number; last_synced_id: number };
    expect(cursor).toEqual({ account_id: 7, last_synced_id: 2 });
  });

  it('paginates: hasMore:true loops until hasMore:false', async () => {
    const { db } = makeTestDb();
    jest.spyOn(client, 'imapStatus').mockResolvedValue(connectedStatus());
    const fetchSpy = jest
      .spyOn(client, 'fetchSyncEntries')
      .mockResolvedValueOnce({ accountId: 7, entries: [sample(1)], hasMore: true, cursor: 1 })
      .mockResolvedValueOnce({ accountId: 7, entries: [sample(2)], hasMore: false, cursor: 2 });
    const r = await syncNow(db);
    expect(r.inserted).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toMatchObject({ since: 1 });
  });

  it('account_id mismatch on first fetch resets cursor', async () => {
    const { db, raw } = makeTestDb();
    raw.prepare('UPDATE sync_cursor SET account_id = 99, last_synced_id = 50 WHERE id = 1').run();
    jest.spyOn(client, 'imapStatus').mockResolvedValue(connectedStatus());
    const fetchSpy = jest.spyOn(client, 'fetchSyncEntries').mockResolvedValueOnce({
      accountId: 7,
      entries: [sample(1)],
      hasMore: false,
      cursor: 1,
    });
    const r = await syncNow(db);
    expect(r.inserted).toBe(1);
    expect(fetchSpy.mock.calls[0][0]).toMatchObject({ since: 0 });
    const cursor = raw
      .prepare('SELECT account_id, last_synced_id FROM sync_cursor')
      .get() as { account_id: number; last_synced_id: number };
    expect(cursor).toEqual({ account_id: 7, last_synced_id: 1 });
  });

  it('idempotent: second call with no new rows inserts 0', async () => {
    const { db } = makeTestDb();
    jest.spyOn(client, 'imapStatus').mockResolvedValue(connectedStatus());
    jest
      .spyOn(client, 'fetchSyncEntries')
      .mockResolvedValueOnce({ accountId: 7, entries: [sample(1)], hasMore: false, cursor: 1 })
      .mockResolvedValueOnce({ accountId: 7, entries: [], hasMore: false, cursor: 1 });
    expect((await syncNow(db)).inserted).toBe(1);
    expect((await syncNow(db)).inserted).toBe(0);
  });

  it('re-entrance returns the same in-flight promise', async () => {
    const { db } = makeTestDb();
    let resolve!: (v: { connected: false }) => void;
    jest.spyOn(client, 'imapStatus').mockImplementation(
      () => new Promise((r) => { resolve = r; }),
    );
    const a = syncNow(db);
    const b = syncNow(db);
    resolve({ connected: false });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe(rb);
  });

  it('account_id changes mid-loop → break, partial inserts persist', async () => {
    const { db, raw } = makeTestDb();
    jest.spyOn(client, 'imapStatus').mockResolvedValue(connectedStatus());
    jest
      .spyOn(client, 'fetchSyncEntries')
      .mockResolvedValueOnce({ accountId: 7, entries: [sample(1)], hasMore: true, cursor: 1 })
      .mockResolvedValueOnce({ accountId: 8, entries: [sample(2)], hasMore: false, cursor: 2 });
    const r = await syncNow(db);
    expect(r.inserted).toBe(1);
    const rows = raw
      .prepare('SELECT synced_entry_id FROM spending_entries ORDER BY synced_entry_id')
      .all() as Array<{ synced_entry_id: number }>;
    expect(rows.map((r) => r.synced_entry_id)).toEqual([1]);
  });

  it('imap status === error surfaces as status:"error" with inserts still flowing', async () => {
    const { db } = makeTestDb();
    jest.spyOn(client, 'imapStatus').mockResolvedValue(connectedStatus({ status: 'error' }));
    jest.spyOn(client, 'fetchSyncEntries').mockResolvedValueOnce({
      accountId: 7,
      entries: [sample(1)],
      hasMore: false,
      cursor: 1,
    });
    const r = await syncNow(db);
    expect(r.status).toBe('error');
    expect(r.inserted).toBe(1);
  });
});
