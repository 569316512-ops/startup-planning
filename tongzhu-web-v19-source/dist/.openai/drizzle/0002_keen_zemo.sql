CREATE TABLE `pilot_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_hash` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `pilot_leads` ADD `housing` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_leads` ADD `photo_ids` text DEFAULT '[]' NOT NULL;