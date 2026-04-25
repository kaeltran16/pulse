import type { ParseResponse, ParseHint } from '../api-types';
import { PAL_BASE_URL, PAL_TOKEN } from './config';
import { AuthError, NetworkError, RateLimitError, UpstreamError, ValidationError } from './errors';

type ErrorEnvelope = { error: { code: string; message: string }; requestId?: string };

async function readError(res: Response): Promise<ErrorEnvelope | null> {
  try { return (await res.json()) as ErrorEnvelope; } catch { return null; }
}

export async function parse(text: string, hint?: ParseHint): Promise<ParseResponse> {
  const body: { text: string; hint?: ParseHint } = { text };
  if (hint) body.hint = hint;

  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/parse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  if (res.ok) return (await res.json()) as ParseResponse;

  const env = await readError(res);
  const rid = env?.requestId;
  const msg = env?.error.message ?? '';
  if (res.status === 401) throw new AuthError(msg, rid);
  if (res.status === 429) throw new RateLimitError(msg, rid);
  if (res.status === 400) throw new ValidationError(msg, rid);
  throw new UpstreamError(msg, rid);
}
