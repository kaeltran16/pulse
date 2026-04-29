CREATE TABLE `generated_reviews` (
	`period` text NOT NULL,
	`period_key` text NOT NULL,
	`payload` text NOT NULL,
	`generated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_generated_reviews_pk` ON `generated_reviews` (`period`,`period_key`);