CREATE TABLE `rate_limit_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`step` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rate_limit_calls_run_step` ON `rate_limit_calls` (`run_id`,`step`);--> statement-breakpoint
CREATE TABLE `rate_limit_windows` (
	`client_key` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`window_started_at` integer NOT NULL
);
