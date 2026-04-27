PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_synced_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer,
	`imap_uid` integer NOT NULL,
	`content_hash` text NOT NULL,
	`cents` integer NOT NULL,
	`currency` text NOT NULL,
	`merchant` text,
	`category` text,
	`occurred_at` integer NOT NULL,
	`recurring` integer DEFAULT 0 NOT NULL,
	`raw_parse_response` text NOT NULL,
	`email_subject` text,
	`email_from` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `imap_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_synced_entries`("id", "account_id", "imap_uid", "content_hash", "cents", "currency", "merchant", "category", "occurred_at", "recurring", "raw_parse_response", "email_subject", "email_from", "created_at") SELECT "id", "account_id", "imap_uid", "content_hash", "cents", "currency", "merchant", "category", "occurred_at", "recurring", "raw_parse_response", "email_subject", "email_from", "created_at" FROM `synced_entries`;--> statement-breakpoint
DROP TABLE `synced_entries`;--> statement-breakpoint
ALTER TABLE `__new_synced_entries` RENAME TO `synced_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_synced_entries_account_created` ON `synced_entries` (`account_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_synced_entries_account_merchant_occurred` ON `synced_entries` (`account_id`,`merchant`,`occurred_at`);