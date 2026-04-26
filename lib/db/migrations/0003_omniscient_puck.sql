PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer,
	`routine_name_snapshot` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`total_volume_kg` real DEFAULT 0 NOT NULL,
	`pr_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "routine_id", "routine_name_snapshot", "status", "started_at", "finished_at", "duration_seconds", "total_volume_kg", "pr_count") SELECT "id", "routine_id", "routine_name_snapshot", 'completed', "started_at", "finished_at", "duration_seconds", "total_volume_kg", "pr_count" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_sessions_started_at` ON `sessions` (`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_one_draft` ON `sessions` (`status`) WHERE status = 'draft';