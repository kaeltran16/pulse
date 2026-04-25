// lib/api-types.ts
// Shared between the Pulse RN app (app/) and the backend (backend/).
// SP2 stubs entity types loosely; SP3a tightens them.

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "validation_failed"
  | "upstream_error"
  | "internal";

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
