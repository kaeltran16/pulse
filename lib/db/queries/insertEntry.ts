import type { ParseResponse } from '../../api-types';
import { spendingEntries, movementEntries } from '../schema';
import type { AnyDb } from './onboarding';

type SpendRow = { cents: number; note: string | null; category: string | null; occurredAt: number };
type MoveRow  = { minutes: number; kind: string | null; note: string | null; occurredAt: number };

export type MappedRow =
  | { table: 'spending_entries'; row: SpendRow }
  | { table: 'movement_entries'; row: MoveRow };

function summarizeSets(sets: Array<{ exercise: string; reps: number; weight?: number }>): string {
  return sets
    .map((s) => `${s.reps}×${s.exercise}${s.weight != null ? ` @${s.weight}` : ''}`)
    .join(', ');
}

export function mapToRow(parsed: ParseResponse, occurredAt: number): MappedRow {
  if (parsed.kind === 'spend') {
    const cents = Math.round((parsed.data.amount + Number.EPSILON) * 100);
    return {
      table: 'spending_entries',
      row: {
        cents,
        note: parsed.data.merchant ?? null,
        category: parsed.data.category ?? null,
        occurredAt,
      },
    };
  }
  if (parsed.kind === 'workout') {
    if (parsed.data.durationMin == null) throw new Error('workout requires durationMin');
    const note = parsed.data.sets && parsed.data.sets.length > 0 ? summarizeSets(parsed.data.sets) : null;
    return {
      table: 'movement_entries',
      row: {
        minutes: parsed.data.durationMin,
        kind: parsed.data.routine ?? 'workout',
        note,
        occurredAt,
      },
    };
  }
  throw new Error(`mapToRow: cannot map kind=${parsed.kind}`);
}

export async function insertEntry(db: AnyDb, parsed: ParseResponse, occurredAt = Date.now()): Promise<void> {
  const m = mapToRow(parsed, occurredAt);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  if (m.table === 'spending_entries') {
    await dx.insert(spendingEntries).values(m.row).run();
  } else {
    await dx.insert(movementEntries).values(m.row).run();
  }
}
