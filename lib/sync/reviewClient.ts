import type { ReviewRequest, ReviewResponse } from '../api-types';
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

export async function postReview(body: ReviewRequest): Promise<ReviewResponse> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/review`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.ok) return (await res.json()) as ReviewResponse;
  throw mapHttpError(res.status, await readError(res));
}
