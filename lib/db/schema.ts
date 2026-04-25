import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

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

export type Goals = typeof goals.$inferSelect;
export type Ritual = typeof rituals.$inferSelect;
export type SpendingEntry = typeof spendingEntries.$inferSelect;
export type MovementEntry = typeof movementEntries.$inferSelect;
export type RitualEntry = typeof ritualEntries.$inferSelect;
