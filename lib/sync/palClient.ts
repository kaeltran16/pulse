import type {
  NudgeTodayRequest,
  NudgeTodayResponse,
  SuggestRitualsRequest,
  SuggestRitualsResponse,
} from '../api-types';
import { PAL_BASE_URL, PAL_TOKEN } from '../pal/config';
import {
  AuthError,
  NetworkError,
  RateLimitError,
  UpstreamError,
  ValidationError,
} from './errors';

type ErrorEnvelope = { error: { code: string; message: string }; requestId?: string };

async function readError(res: Response): Promise<ErrorEnvelope | null> {
  try {
    return (await res.json()) as ErrorEnvelope;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${PAL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function mapHttpError(status: number, env: ErrorEnvelope | null): Error {
  const msg = env?.error.message ?? '';
  const rid = env?.requestId;
  if (status === 400) return new ValidationError(msg, rid);
  if (status === 401 || status === 403) return new AuthError(msg, rid);
  if (status === 429) return new RateLimitError(msg, rid);
  return new UpstreamError(msg, rid);
}

export async function postSuggestRituals(req: SuggestRitualsRequest): Promise<SuggestRitualsResponse> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/suggest-rituals`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.ok) return (await res.json()) as SuggestRitualsResponse;
  throw mapHttpError(res.status, await readError(res));
}

export async function postNudgeToday(req: NudgeTodayRequest): Promise<NudgeTodayResponse> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/nudge-today`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.ok) return (await res.json()) as NudgeTodayResponse;
  throw mapHttpError(res.status, await readError(res));
}
