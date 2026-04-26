/** @jest-environment node */
import { generateRoutine } from '../client';
import {
  AuthError, GenerationFailedError, NetworkError, RateLimitError,
  UpstreamError, ValidationError,
} from '../errors';

const STRENGTH_OK = {
  tag: 'Upper', name: 'Push Day', estMin: 45, rationale: 'why',
  exercises: [
    { id: 'bench', sets: [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }] },
    { id: 'ohp',   sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }, { reps: 8, weight: 40 }] },
    { id: 'tricep-rope', sets: [{ reps: 12, weight: 25 }, { reps: 12, weight: 25 }, { reps: 12, weight: 25 }] },
  ],
};

function mockFetch(status: number, body: unknown): typeof fetch {
  return (async () => {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
}

function mockNetworkFailure(): typeof fetch {
  return (async () => { throw new TypeError('network down'); }) as unknown as typeof fetch;
}

describe('generateRoutine', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('returns the parsed routine on 200', async () => {
    global.fetch = mockFetch(200, STRENGTH_OK);
    const r = await generateRoutine('push day');
    expect(r.tag).toBe('Upper');
    expect(r.exercises).toHaveLength(3);
  });

  it('throws ValidationError on 400 validation_failed', async () => {
    global.fetch = mockFetch(400, { error: { code: 'validation_failed', message: 'bad' }, requestId: 'r1' });
    await expect(generateRoutine('x')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws AuthError on 401', async () => {
    global.fetch = mockFetch(401, { error: { code: 'unauthorized', message: 'no' }, requestId: 'r1' });
    await expect(generateRoutine('x')).rejects.toBeInstanceOf(AuthError);
  });

  it('throws AuthError on 403', async () => {
    global.fetch = mockFetch(403, { error: { code: 'forbidden', message: 'scope' }, requestId: 'r1' });
    await expect(generateRoutine('x')).rejects.toBeInstanceOf(AuthError);
  });

  it('throws RateLimitError on 429', async () => {
    global.fetch = mockFetch(429, { error: { code: 'rate_limited', message: 'slow' }, requestId: 'r1' });
    await expect(generateRoutine('x')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws GenerationFailedError on 502 generation_failed', async () => {
    global.fetch = mockFetch(502, { error: { code: 'generation_failed', message: 'junk' }, requestId: 'r1' });
    await expect(generateRoutine('x')).rejects.toBeInstanceOf(GenerationFailedError);
  });

  it('throws UpstreamError on 502 upstream_error', async () => {
    global.fetch = mockFetch(502, { error: { code: 'upstream_error', message: 'boom' }, requestId: 'r1' });
    await expect(generateRoutine('x')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws UpstreamError on other 5xx', async () => {
    global.fetch = mockFetch(500, { error: { code: 'internal', message: 'oops' }, requestId: 'r1' });
    await expect(generateRoutine('x')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws NetworkError when fetch itself rejects', async () => {
    global.fetch = mockNetworkFailure();
    await expect(generateRoutine('x')).rejects.toBeInstanceOf(NetworkError);
  });
});
