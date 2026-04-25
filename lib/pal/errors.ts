export class PalError extends Error {
  constructor(public readonly code: string, message: string, public readonly requestId?: string) {
    super(message);
    this.name = 'PalError';
  }
}
export class NetworkError  extends PalError { constructor(m = 'Network unreachable') { super('network', m); } }
export class AuthError     extends PalError { constructor(m = 'Unauthorized', rid?: string) { super('unauthorized', m, rid); } }
export class RateLimitError extends PalError { constructor(m = 'Rate limited', rid?: string) { super('rate_limited', m, rid); } }
export class UpstreamError extends PalError { constructor(m = 'Upstream failed', rid?: string) { super('upstream_error', m, rid); } }
export class ValidationError extends PalError { constructor(m = 'Validation failed', rid?: string) { super('validation_failed', m, rid); } }

/** User-facing message for an error. */
export function messageFor(e: unknown): string {
  if (e instanceof NetworkError) return "Couldn't reach Pal. Check your connection.";
  if (e instanceof AuthError) return "Pal isn't authorized — your token may need to be rotated.";
  if (e instanceof RateLimitError) return "Slow down a sec — try again in a minute.";
  if (e instanceof UpstreamError) return "Pal had trouble thinking. Try again?";
  return "Something went wrong. Try again.";
}
