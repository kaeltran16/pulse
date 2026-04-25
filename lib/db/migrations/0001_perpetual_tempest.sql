CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`group` text NOT NULL,
	`muscle` text NOT NULL,
	`equipment` text NOT NULL,
	`kind` text NOT NULL,
	`sf_symbol` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exercise_id` text NOT NULL,
	`weight_kg` real NOT NULL,
	`reps` integer NOT NULL,
	`session_id` integer NOT NULL,
	`achieved_at` integer NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prs_exercise_id_unique` ON `prs` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `routine_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`rest_seconds` integer,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_routine_exercises_routine_position` ON `routine_exercises` (`routine_id`,`position`);--> statement-breakpoint
CREATE TABLE `routine_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_exercise_id` integer NOT NULL,
	`position` integer NOT NULL,
	`target_reps` integer,
	`target_weight_kg` real,
	`target_duration_seconds` integer,
	`target_distance_km` real,
	FOREIGN KEY (`routine_exercise_id`) REFERENCES `routine_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_routine_sets_routine_exercise_position` ON `routine_sets` (`routine_exercise_id`,`position`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`tag` text NOT NULL,
	`color` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` text NOT NULL,
	`exercise_position` integer NOT NULL,
	`set_position` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`duration_seconds` integer,
	`distance_km` real,
	`is_pr` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_session_sets_session_id` ON `session_sets` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_session_sets_exercise_id` ON `session_sets` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer,
	`routine_name_snapshot` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`duration_seconds` integer NOT NULL,
	`total_volume_kg` real DEFAULT 0 NOT NULL,
	`pr_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_started_at` ON `sessions` (`started_at`);