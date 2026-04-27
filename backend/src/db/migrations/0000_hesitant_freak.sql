CREATE TABLE `imap_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email_address` text NOT NULL,
	`credentials_ciphertext` text NOT NULL,
	`sender_allowlist` text DEFAULT '[]' NOT NULL,
	`poll_interval_seconds` integer DEFAULT 300 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_polled_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imap_accounts_email_address_unique` ON `imap_accounts` (`email_address`);--> statement-breakpoint
CREATE TABLE `imap_uids` (
	`account_id` integer NOT NULL,
	`uid` integer NOT NULL,
	`first_seen_at` integer NOT NULL,
	PRIMARY KEY(`account_id`, `uid`),
	FOREIGN KEY (`account_id`) REFERENCES `imap_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `synced_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
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
	FOREIGN KEY (`account_id`) REFERENCES `imap_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_synced_entries_account_created` ON `synced_entries` (`account_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_synced_entries_account_merchant_occurred` ON `synced_entries` (`account_id`,`merchant`,`occurred_at`);