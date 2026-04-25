import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect } from 'react';

import { db } from './client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import migrations from './migrations/migrations';
import { seedWorkouts } from './seed-workouts';

export function useDbMigrations() {
  const result = useMigrations(db, migrations);
  useEffect(() => {
    if (result.success) {
      try {
        seedWorkouts(db);
      } catch (e) {
        console.error('[seedWorkouts] failed:', e);
      }
    }
  }, [result.success]);
  return result;
}
