import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

// drizzle-kit emits this default-export as the migrations bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import migrations from './migrations/migrations';

import { db } from './client';

export function useDbMigrations() {
  return useMigrations(db, migrations);
}
