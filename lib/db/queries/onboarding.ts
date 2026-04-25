import { eq } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import { goals, rituals } from '../schema';
import { DEFAULT_RITUALS } from '../seed-defaults';

// Both DB drivers expose `select`/`insert`/`delete`/`transaction`. better-sqlite3
// requires a synchronous transaction callback; drizzle-orm/expo-sqlite also runs
// its transaction body synchronously (operations are sync under the hood). So we
// use a sync callback and call `.run()` on the builders.
export type AnyDb =
  | BetterSQLite3Database<Record<string, unknown>>
  | ExpoSQLiteDatabase<Record<string, unknown>>;

export interface FinishOnboardingInput {
  dailyBudgetCents: number;
  dailyMoveMinutes: number;
  /** Titles drawn from DEFAULT_RITUALS; order = on-screen order. */
  activeRitualTitles: string[];
}

export async function isOnboardingComplete(db: AnyDb): Promise<boolean> {
  const rows = await db.select({ id: goals.id }).from(goals).where(eq(goals.id, 1));
  return rows.length > 0;
}

export async function finishOnboarding(
  db: AnyDb,
  input: FinishOnboardingInput,
): Promise<void> {
  const target = input.activeRitualTitles.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).transaction((tx: any) => {
    tx.delete(goals).where(eq(goals.id, 1)).run();
    tx.insert(goals).values({
      id: 1,
      dailyBudgetCents: input.dailyBudgetCents,
      dailyMoveMinutes: input.dailyMoveMinutes,
      dailyRitualTarget: target,
    }).run();

    tx.delete(rituals).run();

    let position = 0;
    for (const title of input.activeRitualTitles) {
      const def = DEFAULT_RITUALS.find((d) => d.title === title);
      if (!def) {
        throw new Error(`Unknown default ritual: ${title}`);
      }
      tx.insert(rituals).values({
        title: def.title,
        icon: def.icon,
        active: true,
        position,
      }).run();
      position += 1;
    }
  });
}
