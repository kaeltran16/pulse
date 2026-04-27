import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "../client.js";
import { runMigrations } from "../migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

describe("runMigrations", () => {
  it("creates all three tables on a fresh DB", () => {
    const { db, sqlite } = createDb(":memory:");
    runMigrations(db, migrationsFolder);

    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);

    expect(names).toContain("imap_accounts");
    expect(names).toContain("synced_entries");
    expect(names).toContain("imap_uids");
    expect(names).toContain("__drizzle_migrations");
  });

  it("is idempotent — running twice does not duplicate applied migrations", () => {
    const { db: db1, sqlite: sqlite1 } = createDb(":memory:");
    runMigrations(db1, migrationsFolder);
    const initial = sqlite1
      .prepare("SELECT count(*) as count FROM __drizzle_migrations")
      .get() as { count: number };

    runMigrations(db1, migrationsFolder);
    const afterSecond = sqlite1
      .prepare("SELECT count(*) as count FROM __drizzle_migrations")
      .get() as { count: number };

    expect(afterSecond.count).toBe(initial.count);
  });
});
