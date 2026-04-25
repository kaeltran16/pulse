import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey(),
  dailyBudgetCents: integer('daily_budget_cents').notNull(),
  dailyMoveMinutes: integer('daily_move_minutes').notNull(),
  dailyRitualTarget: integer('daily_ritual_target').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
});

export const rituals = sqliteTable('rituals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  icon: text('icon').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  position: integer('position').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
});

export const spendingEntries = sqliteTable(
  'spending_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cents: integer('cents').notNull(),
    note: text('note'),
    category: text('category'),
    occurredAt: integer('occurred_at').notNull(),
  },
  (t) => ({
    occurredAtIdx: index('idx_spending_occurred_at').on(t.occurredAt),
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
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    totalVolumeKg: real('total_volume_kg').notNull().default(0),
    prCount: integer('pr_count').notNull().default(0),
  },
  (t) => ({
    startedAtIdx: index('idx_sessions_started_at').on(t.startedAt),
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
