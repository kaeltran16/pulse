CREATE TABLE `pal_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `goals` ADD `reminder_time_minutes` integer;--> statement-breakpoint
ALTER TABLE `rituals` ADD `cadence` text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE `rituals` ADD `color` text DEFAULT 'rituals' NOT NULL;--> statement-breakpoint
-- Backfill known seed titles with cadence + color
UPDATE rituals SET cadence = 'morning',  color = 'accent'  WHERE title = 'Morning pages';--> statement-breakpoint
UPDATE rituals SET cadence = 'weekdays', color = 'move'    WHERE title = 'Inbox zero';--> statement-breakpoint
UPDATE rituals SET cadence = 'daily',    color = 'move'    WHERE title = 'Language practice';--> statement-breakpoint
UPDATE rituals SET cadence = 'evening',  color = 'money'   WHERE title = 'Stretch';--> statement-breakpoint
UPDATE rituals SET cadence = 'evening',  color = 'money'   WHERE title = 'Read before bed';--> statement-breakpoint
UPDATE rituals SET cadence = 'morning',  color = 'rituals' WHERE title = 'Meditate';