import type { ParseResponse, ParseHint } from '../api-types';
import { PAL_BASE_URL, PAL_TOKEN } from './config';
import { AuthError, GenerationFailedError, NetworkError, RateLimitError, UpstreamError, ValidationError } from './errors';
import { realSSE, type SSEFactory } from './sse';
import type { GeneratedRoutine } from './types';

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

export async function generateRoutine(goal: string): Promise<GeneratedRoutine> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/generate-routine`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ goal }),
    });
  } catch {
    throw new NetworkError();
  }

  if (res.ok) return (await res.json()) as GeneratedRoutine;

  const env = await readError(res);
  const rid = env?.requestId;
  const code = env?.error.code ?? '';
  const msg = env?.error.message ?? '';

  if (res.status === 400) throw new ValidationError(msg, rid);
  if (res.status === 401 || res.status === 403) throw new AuthError(msg, rid);
  if (res.status === 429) throw new RateLimitError(msg, rid);
  if (res.status === 502 && code === 'generation_failed') throw new GenerationFailedError(msg, rid);
  throw new UpstreamError(msg, rid);
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatRequest = {
  messages: ChatMessage[];
  context?: { recentEntries?: unknown; today?: unknown };
};
export type ChatStreamCallbacks = {
  onChunk(delta: string): void;
  onDone(usage: { input_tokens?: number; output_tokens?: number }): void;
  onError(code: string, message: string): void;
};

export function chatStream(
  req: ChatRequest,
  cb: ChatStreamCallbacks,
  factory: SSEFactory = realSSE,
): { abort: () => void } {
  const es = factory(`${PAL_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  es.addEventListener('chunk', (ev) => {
    if (!ev.data) return;
    try { cb.onChunk((JSON.parse(ev.data) as { delta: string }).delta); }
    catch { /* ignore malformed chunk */ }
  });
  es.addEventListener('done', (ev) => {
    if (!ev.data) { cb.onDone({}); return; }
    try { cb.onDone((JSON.parse(ev.data) as { usage: object }).usage); }
    catch { cb.onDone({}); }
  });
  es.addEventListener('error', (ev) => {
    if (!ev.data) { cb.onError('network', 'Stream error'); return; }
    try {
      const { code, message } = JSON.parse(ev.data) as { code: string; message: string };
      cb.onError(code, message);
    } catch {
      cb.onError('network', 'Stream error');
    }
  });

  return { abort: () => es.close() };
}
