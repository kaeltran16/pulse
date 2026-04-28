import { and, eq, gte, lt, sql } from 'drizzle-orm';

import { rituals, ritualEntries, type RitualCadence, type RitualColor } from '../schema';
import { type AnyDb } from './onboarding';
import { streakForRitual } from './streaks';
import { bumpHwmIfHigher } from './streakHighWater';

export interface InsertRitualInput {
  title: string;
  icon: string;
  cadence: RitualCadence;
  color: RitualColor;
  active?: boolean;
}

export async function insertRitual(db: AnyDb, input: InsertRitualInput): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const positionRows = dx.all(sql`
    SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM rituals
  `) as Array<{ pos: number }>;
  const nextPos = Number(positionRows[0]?.pos ?? 0);

  const result = dx
    .insert(rituals)
    .values({
      title: input.title,
      icon: input.icon,
      cadence: input.cadence,
      color: input.color,
      active: input.active ?? true,
      position: nextPos,
    })
    .returning({ id: rituals.id })
    .all() as Array<{ id: number }>;
  return result[0].id;
}

export interface UpdateRitualInput {
  title: string;
  icon: string;
  cadence: RitualCadence;
  color: RitualColor;
}

export async function updateRitual(db: AnyDb, id: number, input: UpdateRitualInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.update(rituals)
    .set({
      title: input.title,
      icon: input.icon,
      cadence: input.cadence,
      color: input.color,
    })
    .where(eq(rituals.id, id))
    .run();
}

export async function softDeleteRitual(db: AnyDb, id: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.transaction((tx: any) => {
    tx.update(rituals).set({ active: false }).where(eq(rituals.id, id)).run();
    // Recompact positions of remaining active rituals
    const activeIds = tx
      .select({ id: rituals.id })
      .from(rituals)
      .where(eq(rituals.active, true))
      .orderBy(sql`position ASC`)
      .all() as Array<{ id: number }>;
    activeIds.forEach((row, i) => {
      tx.update(rituals).set({ position: i }).where(eq(rituals.id, row.id)).run();
    });
  });
}

export async function restoreRitual(db: AnyDb, id: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const positionRows = dx.all(sql`
    SELECT COALESCE(MAX(position) + 1, 0) AS pos
    FROM rituals WHERE active = 1
  `) as Array<{ pos: number }>;
  const nextPos = Number(positionRows[0]?.pos ?? 0);
  dx.update(rituals)
    .set({ active: true, position: nextPos })
    .where(eq(rituals.id, id))
    .run();
}

export async function hardDeleteRitual(db: AnyDb, id: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.delete(rituals).where(eq(rituals.id, id)).run();
  // ritualEntries cascade via FK ON DELETE CASCADE
}

export async function reorderRitualPositions(db: AnyDb, orderedIds: number[]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.transaction((tx: any) => {
    orderedIds.forEach((id, i) => {
      tx.update(rituals).set({ position: i }).where(eq(rituals.id, id)).run();
    });
  });
}

function todayBounds(todayKey: string): { startMs: number; endMs: number } {
  const [y, m, d] = todayKey.split('-').map(Number);
  // Local-midnight bounds; constructed via new Date(y, m-1, d) is DST-safe
  // (unlike adding 24h, which breaks across DST transitions).
  const startMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const endMs   = new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();
  return { startMs, endMs };
}

export async function toggleRitualToday(db: AnyDb, ritualId: number, todayKey: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const { startMs, endMs } = todayBounds(todayKey);
  const existing = dx
    .select({ id: ritualEntries.id })
    .from(ritualEntries)
    .where(and(
      eq(ritualEntries.ritualId, ritualId),
      gte(ritualEntries.occurredAt, startMs),
      lt(ritualEntries.occurredAt, endMs),
    ))
    .all() as Array<{ id: number }>;
  if (existing.length > 0) {
    dx.delete(ritualEntries)
      .where(and(
        eq(ritualEntries.ritualId, ritualId),
        gte(ritualEntries.occurredAt, startMs),
        lt(ritualEntries.occurredAt, endMs),
      ))
      .run();
    return;
  }
  const nowMs = Date.now();
  dx.insert(ritualEntries).values({ ritualId, occurredAt: nowMs }).run();

  const allEntries = dx
    .select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt })
    .from(ritualEntries)
    .all() as Array<{ ritualId: number; occurredAt: number }>;
  const current = streakForRitual({
    ritualEntries: allEntries,
    ritualId,
    asOf: new Date(nowMs),
  });
  await bumpHwmIfHigher(db, ritualId, current, nowMs);
}
