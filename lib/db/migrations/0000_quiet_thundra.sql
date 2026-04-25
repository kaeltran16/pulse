CREATE TABLE `goals` (
	`id` integer PRIMARY KEY NOT NULL,
	`daily_budget_cents` integer NOT NULL,
	`daily_move_minutes` integer NOT NULL,
	`daily_ritual_target` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `movement_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`minutes` integer NOT NULL,
	`kind` text,
	`note` text,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_movement_occurred_at` ON `movement_entries` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `ritual_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ritual_id` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`ritual_id`) REFERENCES `rituals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ritual_entries_ritual_id` ON `ritual_entries` (`ritual_id`);--> statement-breakpoint
CREATE INDEX `idx_ritual_entries_occurred_at` ON `ritual_entries` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `rituals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`icon` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spending_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cents` integer NOT NULL,
	`note` text,
	`category` text,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_spending_occurred_at` ON `spending_entries` (`occurred_at`);