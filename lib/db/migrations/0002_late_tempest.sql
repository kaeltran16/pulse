ALTER TABLE `routines` ADD `rest_default_seconds` integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `warmup_reminder` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `auto_progress` integer DEFAULT false NOT NULL;