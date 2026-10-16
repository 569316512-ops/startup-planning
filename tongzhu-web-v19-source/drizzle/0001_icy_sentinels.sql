CREATE TABLE `pilot_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event` text NOT NULL,
	`city` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pilot_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_hash` text NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`city` text NOT NULL,
	`district` text NOT NULL,
	`budget` integer NOT NULL,
	`move_in` text NOT NULL,
	`note` text NOT NULL,
	`nickname` text NOT NULL,
	`contact_type` text NOT NULL,
	`contact_value` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_leads_receipt_hash_unique` ON `pilot_leads` (`receipt_hash`);