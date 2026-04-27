CREATE TABLE `sync_cursor` (
	`id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
	`account_id` integer,
	`last_synced_id` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `sync_cursor` (`id`) VALUES (1);
--> statement-breakpoint
ALTER TABLE `spending_entries` ADD `merchant` text;--> statement-breakpoint
ALTER TABLE `spending_entries` ADD `currency` text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `spending_entries` ADD `recurring` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `spending_entries` ADD `synced_entry_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spending_synced_entry_id` ON `spending_entries` (`synced_entry_id`) WHERE synced_entry_id IS NOT NULL;