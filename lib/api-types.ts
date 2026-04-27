// lib/api-types.ts
// Shared between the Pulse RN app (app/) and the backend (backend/).
// SP2 stubs entity types loosely; SP3a tightens them.

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "validation_failed"
  | "generation_failed"
  | "upstream_error"
  | "internal"
  // SP5c — /imap and /sync routes
  | "invalid_request"
  | "imap_auth_failed"
  | "already_connected"
  | "server_misconfig";

export type ErrorEnvelope = {
  error: { code: ErrorCode; message: string };
  requestId: string;
};

// --- Stub entity types (SP3a will replace) ---

export type Entry = {
  id: string;
  kind: "workout" | "spend";
  at: string; // ISO 8601
  note?: string;
};

export type WorkoutEntry = {
  routine?: string;
  sets?: Array<{ exercise: string; reps: number; weight?: number }>;
  durationMin?: number;
};

export type SpendEntry = {
  amount: number;
  currency: string; // ISO 4217
  category?: string;
  merchant?: string;
};

export type TodaySummary = {
  date: string; // YYYY-MM-DD
  rings?: { move?: number; exercise?: number; stand?: number };
  totals?: { calories?: number; spendMinor?: number };
};

export type WorkoutAggregate = { sessions: number; totalVolume?: number };
export type FoodAggregate = { avgCalories?: number; days: number };
export type SpendAggregate = { totalMinor: number; currency: string; byCategory?: Record<string, number> };
export type RitualAggregate = { streaks?: Record<string, number> };

// --- /chat ---

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  messages: ChatMessage[];
  context?: {
    recentEntries?: Entry[];
    today?: TodaySummary;
  };
};

// SSE events emitted by /chat (documented for client consumers in SP3b)
export type ChatStreamEvent =
  | { event: "chunk"; data: { delta: string } }
  | { event: "done"; data: { usage: { inputTokens: number; outputTokens: number } } }
  | { event: "error"; data: { code: ErrorCode; message: string; requestId: string } };

// --- /parse ---

export type ParseHint = "workout" | "spend";

export type ParseRequest = {
  text: string;
  hint?: ParseHint;
};

export type ParseConfidence = "high" | "low";

export type ParseResponse =
  | { kind: "workout"; data: WorkoutEntry; confidence: ParseConfidence; raw: string }
  | { kind: "spend"; data: SpendEntry; confidence: ParseConfidence; raw: string }
  | { kind: "chat"; confidence: "high"; raw: string };

// --- /review ---

export type ReviewRequest = {
  month: string; // "YYYY-MM"
  aggregates: {
    workouts: WorkoutAggregate;
    food: FoodAggregate;
    spend: SpendAggregate;
    rituals: RitualAggregate;
  };
};

export type ReviewResponse = {
  markdown: string;
  generatedAt: string; // ISO 8601 UTC
};

// --- SP5c — Email sync ---

export type ConnectRequest = {
  email: string;
  appPassword: string;
  senderAllowlist?: string[];
};

export type ConnectResponse = {
  accountId: number;
  status: "active";
  emailAddress: string;
};

export type ImapStatusResponse =
  | { connected: false }
  | {
      connected: true;
      accountId: number;
      emailAddress: string;
      status: "active" | "paused" | "error";
      lastPolledAt: number | null;
      lastError: string | null;
      pollIntervalSeconds: number;
      senderAllowlist: string[];
    };

export type SyncedEntryDTO = {
  id: number;
  merchant: string | null;
  cents: number;
  currency: string;
  category: string | null;
  occurredAt: number;
  recurring: boolean;
  emailFrom: string | null;
};

export type SyncEntriesResponse = {
  accountId: number | null;
  entries: SyncedEntryDTO[];
  hasMore: boolean;
  cursor: number;
};

// --- /suggest-rituals + /nudge-today (SP5e) ---

export type RitualCadence = 'morning' | 'evening' | 'all_day' | 'weekdays' | 'daily';
export type RitualColor   = 'rituals' | 'accent' | 'move' | 'money' | 'cyan';

export const RITUAL_ICON_SHORTLIST = [
  'book.closed.fill', 'tray.fill', 'character.book.closed.fill',
  'dumbbell.fill', 'books.vertical.fill', 'heart.fill',
  'sparkles', 'cup.and.saucer.fill', 'leaf.fill', 'moon.fill',
  'figure.walk', 'drop.fill', 'fork.knife', 'music.note',
  'bed.double.fill', 'sun.max.fill',
] as const;
export type RitualIcon = typeof RITUAL_ICON_SHORTLIST[number];

export type SuggestRitualsRequest = {
  active: Array<{ title: string; cadence: RitualCadence; color: RitualColor }>;
  recentRitualEntries?: Array<{ title: string; occurredAt: number }>;
};

export type SuggestRitualsResponse = {
  suggestions: Array<{
    title: string;
    reason: string;
    icon: RitualIcon;
    cadence: RitualCadence;
    color: RitualColor;
  }>;
};

export type NudgeTodayRequest = {
  date: string;          // YYYY-MM-DD local
  done: number;
  total: number;
  remaining: Array<{ title: string; streak: number; cadence: RitualCadence }>;
  bestStreak?: { title: string; streak: number };
};

export type NudgeTodayResponse = { sub: string };
