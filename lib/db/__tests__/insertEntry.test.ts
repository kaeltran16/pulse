/** @jest-environment node */
import { makeTestDb } from './test-helpers';
import { insertEntry, mapToRow } from '../queries/insertEntry';
import { spendingEntries, movementEntries } from '../schema';

describe('mapToRow (pure)', () => {
  it('maps spend with merchant + category', () => {
    const r = mapToRow({
      kind: 'spend',
      data: { amount: 5.75, currency: 'USD', merchant: 'Verve', category: 'coffee' },
      confidence: 'high',
      raw: 'verve $5.75',
    }, 1700000000000);
    expect(r).toEqual({
      table: 'spending_entries',
      row: { cents: 575, note: 'Verve', category: 'coffee', occurredAt: 1700000000000 },
    });
  });

  it('rounds amount * 100 for spend', () => {
    const r = mapToRow({
      kind: 'spend',
      data: { amount: 1.005, currency: 'USD' },
      confidence: 'high',
      raw: 'x',
    }, 1);
    expect(r.row.cents).toBe(101);
  });

  it('maps workout with duration + routine', () => {
    const r = mapToRow({
      kind: 'workout',
      data: { durationMin: 30, routine: 'run' },
      confidence: 'high',
      raw: 'ran 30 min',
    }, 1700000000000);
    expect(r).toEqual({
      table: 'movement_entries',
      row: { minutes: 30, kind: 'run', note: null, occurredAt: 1700000000000 },
    });
  });

  it('summarizes workout sets into note', () => {
    const r = mapToRow({
      kind: 'workout',
      data: {
        durationMin: 42,
        sets: [
          { exercise: 'squat', reps: 5, weight: 225 },
          { exercise: 'bench', reps: 8 },
        ],
      },
      confidence: 'high',
      raw: 'push day',
    }, 1);
    expect(r.row.minutes).toBe(42);
    expect(r.row.note).toBe('5×squat @225, 8×bench');
  });

  it('defaults workout kind to "workout" when routine missing', () => {
    const r = mapToRow({
      kind: 'workout',
      data: { durationMin: 20 },
      confidence: 'high',
      raw: 'x',
    }, 1);
    expect(r.row.kind).toBe('workout');
  });

  it('throws when workout has no durationMin', () => {
    expect(() =>
      mapToRow({ kind: 'workout', data: { routine: 'run' }, confidence: 'low', raw: 'x' }, 1),
    ).toThrow(/duration/i);
  });
});

describe('insertEntry (writes)', () => {
  it('writes a spend row to spending_entries', async () => {
    const { db } = makeTestDb();
    await insertEntry(db, {
      kind: 'spend',
      data: { amount: 5.75, currency: 'USD', merchant: 'Verve' },
      confidence: 'high',
      raw: 'x',
    }, 1700000000000);
    const rows = db.select().from(spendingEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cents: 575, note: 'Verve', occurredAt: 1700000000000 });
  });

  it('writes a workout row to movement_entries', async () => {
    const { db } = makeTestDb();
    await insertEntry(db, {
      kind: 'workout',
      data: { durationMin: 30, routine: 'run' },
      confidence: 'high',
      raw: 'x',
    }, 1700000000000);
    const rows = db.select().from(movementEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ minutes: 30, kind: 'run', occurredAt: 1700000000000 });
  });
});
