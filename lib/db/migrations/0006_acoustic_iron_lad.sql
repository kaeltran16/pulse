CREATE TABLE `dismissed_close_outs` (
	`date_key` text PRIMARY KEY NOT NULL,
	`dismissed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ritual_streak_high_water` (
	`ritual_id` integer PRIMARY KEY NOT NULL,
	`hwm` integer DEFAULT 0 NOT NULL,
	`reached_at` integer NOT NULL,
	FOREIGN KEY (`ritual_id`) REFERENCES `rituals`(`id`) ON UPDATE no action ON DELETE cascade
);
