import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "../client.js";
import { runMigrations } from "../migrate.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("DB_PATH env var required");
  process.exit(2);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

const { db, sqlite } = createDb(dbPath);
try {
  runMigrations(db, migrationsFolder);
  console.log(`migrations applied to ${dbPath}`);
} finally {
  sqlite.close();
}
