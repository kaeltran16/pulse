import { eq, sql } from 'drizzle-orm';

import { rituals, type RitualCadence, type RitualColor } from '../schema';
import { type AnyDb } from './onboarding';

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
