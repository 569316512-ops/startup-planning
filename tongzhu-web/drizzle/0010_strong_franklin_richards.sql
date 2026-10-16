CREATE TABLE `password_resets` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`password_snapshot` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`used_at` text,
	`claim` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`contact` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
