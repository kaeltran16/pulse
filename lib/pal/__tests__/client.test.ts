/** @jest-environment node */
import { parse, chatStream } from '../client';
import { AuthError, NetworkError, RateLimitError, UpstreamError, ValidationError } from '../errors';
import type { SSEHandle } from '../sse';

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

class FakeSSE implements SSEHandle {
  listeners = new Map<string, (ev: { data?: string }) => void>();
  closed = false;
  addEventListener(name: string, cb: (ev: { data?: string }) => void) {
    this.listeners.set(name, cb);
  }
  close() { this.closed = true; }
  fire(name: string, data?: string) { this.listeners.get(name)?.({ data }); }
}

describe('chatStream()', () => {
  it('opens SSE to /chat with bearer + body, dispatches chunk/done', () => {
    const fake = new FakeSSE();
    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    const ctrl = chatStream(
      { messages: [{ role: 'user', content: 'hi' }] },
      { onChunk, onDone, onError },
      () => fake,
    );

    fake.fire('chunk', JSON.stringify({ delta: 'Hel' }));
    fake.fire('chunk', JSON.stringify({ delta: 'lo.' }));
    fake.fire('done', JSON.stringify({ usage: { input_tokens: 1, output_tokens: 2 } }));

    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hel');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'lo.');
    expect(onDone).toHaveBeenCalledWith({ input_tokens: 1, output_tokens: 2 });
    expect(onError).not.toHaveBeenCalled();
    ctrl.abort();
    expect(fake.closed).toBe(true);
  });

  it('dispatches error event with code+message', () => {
    const fake = new FakeSSE();
    const cb = { onChunk: jest.fn(), onDone: jest.fn(), onError: jest.fn() };
    chatStream({ messages: [{ role: 'user', content: 'hi' }] }, cb, () => fake);
    fake.fire('error', JSON.stringify({ code: 'upstream_error', message: 'down', requestId: 'r' }));
    expect(cb.onError).toHaveBeenCalledWith('upstream_error', 'down');
  });

  it('abort closes the underlying source without firing onDone', () => {
    const fake = new FakeSSE();
    const cb = { onChunk: jest.fn(), onDone: jest.fn(), onError: jest.fn() };
    const ctrl = chatStream({ messages: [{ role: 'user', content: 'hi' }] }, cb, () => fake);
    ctrl.abort();
    expect(fake.closed).toBe(true);
    expect(cb.onDone).not.toHaveBeenCalled();
  });
});
