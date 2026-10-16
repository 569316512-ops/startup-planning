CREATE TABLE `membership_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`amount` integer DEFAULT 3000 NOT NULL,
	`status` text DEFAULT 'awaiting_payment' NOT NULL,
	`proof_key` text,
	`proof_type` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payment_channels` (
	`channel` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `publication_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `pilot_leads` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_leads` ADD `gender` text DEFAULT '未公开' NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_leads` ADD `avatar` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_leads` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `member_until` text;