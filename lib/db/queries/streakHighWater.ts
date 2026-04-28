import { eq } from 'drizzle-orm';

import { ritualStreakHighWater } from '../schema';
import { type AnyDb } from './onboarding';

export async function getHwm(db: AnyDb, ritualId: number): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const rows = dx
    .select({ hwm: ritualStreakHighWater.hwm })
    .from(ritualStreakHighWater)
    .where(eq(ritualStreakHighWater.ritualId, ritualId))
    .all() as Array<{ hwm: number }>;
  return rows[0]?.hwm ?? 0;
}

export interface BumpResult {
  wasBroken: boolean;
  previous: number;
  current: number;
}

export async function bumpHwmIfHigher(
  db: AnyDb,
  ritualId: number,
  current: number,
  nowMs: number,
): Promise<BumpResult> {
  const previous = await getHwm(db, ritualId);
  if (current <= previous) {
    return { wasBroken: false, previous, current };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  if (previous === 0) {
    dx.insert(ritualStreakHighWater)
      .values({ ritualId, hwm: current, reachedAt: nowMs })
      .run();
  } else {
    dx.update(ritualStreakHighWater)
      .set({ hwm: current, reachedAt: nowMs })
      .where(eq(ritualStreakHighWater.ritualId, ritualId))
      .run();
  }
  return { wasBroken: true, previous, current };
}

export async function clearHwm(db: AnyDb, ritualId: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.delete(ritualStreakHighWater)
    .where(eq(ritualStreakHighWater.ritualId, ritualId))
    .run();
}
