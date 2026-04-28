import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export type RitualCadence = 'morning' | 'evening' | 'all_day' | 'weekdays' | 'daily';
export type RitualColor   = 'rituals' | 'accent' | 'move' | 'money' | 'cyan';

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey(),
  dailyBudgetCents: integer('daily_budget_cents').notNull(),
  dailyMoveMinutes: integer('daily_move_minutes').notNull(),
  dailyRitualTarget: integer('daily_ritual_target').notNull(),
  reminderTimeMinutes: integer('reminder_time_minutes'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
});

export const rituals = sqliteTable('rituals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  icon: text('icon').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  position: integer('position').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  cadence: text('cadence').$type<RitualCadence>().notNull().default('daily'),
  color: text('color').$type<RitualColor>().notNull().default('rituals'),
});

export const spendingEntries = sqliteTable(
  'spending_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cents: integer('cents').notNull(),
    note: text('note'),
    category: text('category'),
    occurredAt: integer('occurred_at').notNull(),
    // SP5c: sync metadata. Hand-logged entries leave these at defaults.
    merchant: text('merchant'),
    currency: text('currency').notNull().default('USD'),
    recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
    syncedEntryId: integer('synced_entry_id'),
  },
  (t) => ({
    occurredAtIdx: index('idx_spending_occurred_at').on(t.occurredAt),
    syncedEntryIdIdx: uniqueIndex('idx_spending_synced_entry_id')
      .on(t.syncedEntryId)
      .where(sql`synced_entry_id IS NOT NULL`),
  }),
);

export const movementEntries = sqliteTable(
  'movement_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    minutes: integer('minutes').notNull(),
    kind: text('kind'),
    note: text('note'),
    occurredAt: integer('occurred_at').notNull(),
  },
  (t) => ({
    occurredAtIdx: index('idx_movement_occurred_at').on(t.occurredAt),
  }),
);

export const ritualEntries = sqliteTable(
  'ritual_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ritualId: integer('ritual_id')
      .notNull()
      .references(() => rituals.id, { onDelete: 'cascade' }),
    occurredAt: integer('occurred_at').notNull(),
  },
  (t) => ({
    ritualIdIdx: index('idx_ritual_entries_ritual_id').on(t.ritualId),
    occurredAtIdx: index('idx_ritual_entries_occurred_at').on(t.occurredAt),
  }),
);

// ─── Workouts ─────────────────────────────────────────────────────────────

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  group: text('group').notNull(),
  muscle: text('muscle').notNull(),
  equipment: text('equipment').notNull(),
  kind: text('kind').notNull(),
  sfSymbol: text('sf_symbol').notNull(),
});

export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  tag: text('tag').notNull(),
  color: text('color').notNull(),
  position: integer('position').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  restDefaultSeconds: integer('rest_default_seconds').notNull().default(120),
  warmupReminder: integer('warmup_reminder', { mode: 'boolean' }).notNull().default(false),
  autoProgress: integer('auto_progress', { mode: 'boolean' }).notNull().default(false),
});

export const routineExercises = sqliteTable(
  'routine_exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routineId: integer('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    position: integer('position').notNull(),
    restSeconds: integer('rest_seconds'),
  },
  (t) => ({
    routinePositionIdx: index('idx_routine_exercises_routine_position').on(t.routineId, t.position),
  }),
);

export const routineSets = sqliteTable(
  'routine_sets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routineExerciseId: integer('routine_exercise_id')
      .notNull()
      .references(() => routineExercises.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    targetReps: integer('target_reps'),
    targetWeightKg: real('target_weight_kg'),
    targetDurationSeconds: integer('target_duration_seconds'),
    targetDistanceKm: real('target_distance_km'),
  },
  (t) => ({
    routineExercisePositionIdx: index('idx_routine_sets_routine_exercise_position').on(
      t.routineExerciseId,
      t.position,
    ),
  }),
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routineId: integer('routine_id').references(() => routines.id, { onDelete: 'set null' }),
    routineNameSnapshot: text('routine_name_snapshot').notNull(),
    status: text('status', { enum: ['draft', 'completed'] }).notNull().default('completed'),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    totalVolumeKg: real('total_volume_kg').notNull().default(0),
    prCount: integer('pr_count').notNull().default(0),
  },
  (t) => ({
    startedAtIdx: index('idx_sessions_started_at').on(t.startedAt),
    oneDraftIdx: uniqueIndex('idx_sessions_one_draft').on(t.status).where(sql`status = 'draft'`),
  }),
);

export const sessionSets = sqliteTable(
  'session_sets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    exercisePosition: integer('exercise_position').notNull(),
    setPosition: integer('set_position').notNull(),
    reps: integer('reps'),
    weightKg: real('weight_kg'),
    durationSeconds: integer('duration_seconds'),
    distanceKm: real('distance_km'),
    isPr: integer('is_pr').notNull().default(0),
  },
  (t) => ({
    sessionIdIdx:  index('idx_session_sets_session_id').on(t.sessionId),
    exerciseIdIdx: index('idx_session_sets_exercise_id').on(t.exerciseId),
  }),
);

export const prs = sqliteTable('prs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exerciseId: text('exercise_id')
    .notNull()
    .unique()
    .references(() => exercises.id),
  weightKg: real('weight_kg').notNull(),
  reps: integer('reps').notNull(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  achievedAt: integer('achieved_at').notNull(),
});

// SP5c: single-row cursor table tracking last successfully-synced entry per
// connected account. The (id = 1) CHECK is added by hand in 0004_*.sql since
// Drizzle's column DSL cannot express it.
export const syncCursor = sqliteTable('sync_cursor', {
  id: integer('id').primaryKey(),
  accountId: integer('account_id'),
  lastSyncedId: integer('last_synced_id').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
});

export type SyncCursor = typeof syncCursor.$inferSelect;

export const palCache = sqliteTable('pal_cache', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
});

export type PalCacheRow = typeof palCache.$inferSelect;

export const ritualStreakHighWater = sqliteTable('ritual_streak_high_water', {
  ritualId: integer('ritual_id')
    .primaryKey()
    .references(() => rituals.id, { onDelete: 'cascade' }),
  hwm: integer('hwm').notNull().default(0),
  reachedAt: integer('reached_at').notNull(),
});

export const dismissedCloseOuts = sqliteTable('dismissed_close_outs', {
  dateKey: text('date_key').primaryKey(),
  dismissedAt: integer('dismissed_at').notNull(),
});

export type RitualStreakHighWaterRow = typeof ritualStreakHighWater.$inferSelect;
export type DismissedCloseOutRow = typeof dismissedCloseOuts.$inferSelect;

export type Goals = typeof goals.$inferSelect;
export type Ritual = typeof rituals.$inferSelect;
export type SpendingEntry = typeof spendingEntries.$inferSelect;
export type MovementEntry = typeof movementEntries.$inferSelect;
export type RitualEntry = typeof ritualEntries.$inferSelect;

export type Exercise = typeof exercises.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type RoutineSet = typeof routineSets.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionSet = typeof sessionSets.$inferSelect;
export type PR = typeof prs.$inferSelect;
