CREATE TABLE `contact_views` (
	`viewer_id` text NOT NULL,
	`day` text NOT NULL,
	`target_hash` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`viewer_id`, `day`, `target_hash`),
	FOREIGN KEY (`viewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `pilot_leads` ADD `contact_visibility` text DEFAULT 'operator' NOT NULL;