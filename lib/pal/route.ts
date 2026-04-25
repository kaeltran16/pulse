import type { ParseResponse } from '../api-types';
import { parse, chatStream, type ChatMessage } from './client';
import { insertEntry } from '../db/queries/insertEntry';
import { ValidationError, messageFor } from './errors';
import type { AnyDb } from '../db/queries/onboarding';
import type { PalContext } from './context';

export type RouteCallbacks = {
  onAssistantStart(id: string): void;
  onChunk(id: string, delta: string): void;
  onDone(id: string): void;
  onError(id: string, message: string): void;
  onCommit(entry: ParseResponse): void;
  onConfirmNeeded(entry: ParseResponse): void;
};

export type RouteContext = {
  messagesForChat: ChatMessage[];
  context: PalContext | object;
};

let _idSeq = 0;
const newId = () => `b${Date.now()}_${++_idSeq}`;

function startChat(ctx: RouteContext, cb: RouteCallbacks): { abort: () => void } {
  const id = newId();
  cb.onAssistantStart(id);
  return chatStream(
    { messages: ctx.messagesForChat, context: ctx.context as never },
    {
      onChunk: (d) => cb.onChunk(id, d),
      onDone: () => cb.onDone(id),
      onError: (_code, msg) => cb.onError(id, msg),
    },
  );
}

export async function route(
  text: string,
  ctx: RouteContext,
  deps: { db: AnyDb },
  cb: RouteCallbacks,
): Promise<{ abort: () => void } | undefined> {
  let r: ParseResponse;
  try {
    r = await parse(text);
  } catch (err) {
    if (err instanceof ValidationError) {
      return startChat(ctx, cb);
    }
    cb.onError(newId(), messageFor(err));
    return undefined;
  }

  if (r.kind === 'chat') return startChat(ctx, cb);

  if (r.confidence === 'high') {
    try { await insertEntry(deps.db, r); }
    catch { cb.onError(newId(), "Couldn't save the entry — try again."); return undefined; }
    cb.onCommit(r);
    return undefined;
  }

  cb.onConfirmNeeded(r);
  return undefined;
}
