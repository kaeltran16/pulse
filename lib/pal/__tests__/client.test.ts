/** @jest-environment node */
import { parse } from '../client';
import { AuthError, NetworkError, RateLimitError, UpstreamError, ValidationError } from '../errors';

const BASE = 'http://test.local';
const TOKEN = 'tok-abc';

jest.mock('../config', () => ({ PAL_BASE_URL: 'http://test.local', PAL_TOKEN: 'tok-abc' }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  // @ts-expect-error override global fetch
  global.fetch = fetchMock;
});

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('parse()', () => {
  it('POSTs /parse with bearer auth and { text } body', async () => {
    fetchMock.mockReturnValue(json(200, { kind: 'chat', confidence: 'high', raw: 'hi' }));
    await parse('hi');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/parse`);
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe(`Bearer ${TOKEN}`);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ text: 'hi' });
  });

  it('passes hint when given', async () => {
    fetchMock.mockReturnValue(json(200, { kind: 'spend', data: { amount: 5, currency: 'USD' }, confidence: 'high', raw: 'x' }));
    await parse('x', 'spend');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ text: 'x', hint: 'spend' });
  });

  it('returns the parsed response body on 200', async () => {
    const body = { kind: 'spend', data: { amount: 5, currency: 'USD' }, confidence: 'high', raw: 'x' };
    fetchMock.mockReturnValue(json(200, body));
    expect(await parse('x')).toEqual(body);
  });

  it('throws AuthError on 401', async () => {
    fetchMock.mockReturnValue(json(401, { error: { code: 'unauthorized', message: 'no' }, requestId: 'r1' }));
    await expect(parse('x')).rejects.toBeInstanceOf(AuthError);
  });

  it('throws RateLimitError on 429', async () => {
    fetchMock.mockReturnValue(json(429, { error: { code: 'rate_limited', message: 'slow' }, requestId: 'r2' }));
    await expect(parse('x')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws UpstreamError on 5xx', async () => {
    fetchMock.mockReturnValue(json(502, { error: { code: 'upstream_error', message: 'boom' }, requestId: 'r3' }));
    await expect(parse('x')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws ValidationError on 400', async () => {
    fetchMock.mockReturnValue(json(400, { error: { code: 'validation_failed', message: 'no' }, requestId: 'r4' }));
    await expect(parse('x')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NetworkError when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(parse('x')).rejects.toBeInstanceOf(NetworkError);
  });
});
