/** @jest-environment node */
import { imapConnect, imapStatus, imapDisconnect, fetchSyncEntries } from '../client';
import { AuthError, ValidationError, NetworkError } from '../errors';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
});

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function err(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('sync/client', () => {
  it('imapConnect happy path', async () => {
    fetchMock.mockResolvedValue(ok({ accountId: 5, status: 'active', emailAddress: 'a@gmail.com' }, 201));
    const r = await imapConnect({ email: 'a@gmail.com', appPassword: 'p', senderAllowlist: [] });
    expect(r.accountId).toBe(5);
  });

  it('imapConnect maps 401 → AuthError', async () => {
    fetchMock.mockResolvedValue(err('imap_auth_failed', 'no login', 401));
    await expect(imapConnect({ email: 'a@gmail.com', appPassword: 'p' })).rejects.toBeInstanceOf(AuthError);
  });

  it('imapConnect maps 400 → ValidationError', async () => {
    fetchMock.mockResolvedValue(err('invalid_request', 'bad email', 400));
    await expect(imapConnect({ email: 'bad', appPassword: 'p' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('imapConnect throws NetworkError on fetch rejection', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    await expect(imapConnect({ email: 'a@gmail.com', appPassword: 'p' })).rejects.toBeInstanceOf(NetworkError);
  });

  it('imapStatus returns the body', async () => {
    fetchMock.mockResolvedValue(ok({ connected: false }));
    const s = await imapStatus();
    expect(s).toEqual({ connected: false });
  });

  it('imapDisconnect resolves on 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(imapDisconnect()).resolves.toBeUndefined();
  });

  it('fetchSyncEntries passes since/limit and returns body', async () => {
    fetchMock.mockResolvedValue(ok({ accountId: 1, entries: [], hasMore: false, cursor: 0 }));
    const r = await fetchSyncEntries({ since: 5, limit: 100 });
    expect(r.accountId).toBe(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/since=5/);
    expect(calledUrl).toMatch(/limit=100/);
  });
});
