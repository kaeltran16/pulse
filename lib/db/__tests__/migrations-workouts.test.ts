/** @jest-environment node */
import { makeTestDb } from './test-helpers';

describe('SP4a migration', () => {
  it('creates the full table set (SP3a + SP4a)', () => {
    const { raw } = makeTestDb();
    const rows = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all() as { name: string }[];
    const names = rows.map((r) => r.name).sort();
    expect(names).toEqual([
      'exercises',
      'goals',
      'movement_entries',
      'pal_cache',
      'prs',
      'ritual_entries',
      'rituals',
      'routine_exercises',
      'routine_sets',
      'routines',
      'session_sets',
      'sessions',
      'spending_entries',
      'sync_cursor',
    ]);
  });

  it('creates the SP4a indexes', () => {
    const { raw } = makeTestDb();
    const rows = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
      )
      .all() as { name: string }[];
    const names = rows.map((r) => r.name).sort();
    expect(names).toEqual([
      'idx_movement_occurred_at',
      'idx_ritual_entries_occurred_at',
      'idx_ritual_entries_ritual_id',
      'idx_routine_exercises_routine_position',
      'idx_routine_sets_routine_exercise_position',
      'idx_session_sets_exercise_id',
      'idx_session_sets_session_id',
      'idx_sessions_one_draft',
      'idx_sessions_started_at',
      'idx_spending_occurred_at',
      'idx_spending_synced_entry_id',
    ]);
  });

  it('enforces routine_exercises.routine_id foreign key', () => {
    const { raw } = makeTestDb();
    expect(() =>
      raw
        .prepare(
          'INSERT INTO routine_exercises (routine_id, exercise_id, position) VALUES (?, ?, ?)',
        )
        .run(999, 'bench', 0),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('enforces prs.exercise_id UNIQUE', () => {
    const { raw } = makeTestDb();
    raw.prepare('INSERT INTO exercises (id, name, "group", muscle, equipment, kind, sf_symbol) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('bench', 'Bench', 'Push', 'Chest', 'Barbell', 'strength', 'figure.x');
    raw.prepare('INSERT INTO sessions (routine_name_snapshot, started_at, finished_at, duration_seconds) VALUES (?, ?, ?, ?)')
      .run('Push A', 0, 1000, 1);
    raw.prepare('INSERT INTO prs (exercise_id, weight_kg, reps, session_id, achieved_at) VALUES (?, ?, ?, ?, ?)')
      .run('bench', 80, 5, 1, 0);
    expect(() =>
      raw.prepare('INSERT INTO prs (exercise_id, weight_kg, reps, session_id, achieved_at) VALUES (?, ?, ?, ?, ?)')
        .run('bench', 90, 5, 1, 0),
    ).toThrow(/UNIQUE/i);
  });
});
