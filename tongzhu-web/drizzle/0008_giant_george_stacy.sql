ALTER TABLE `pilot_leads` ADD `min_lease_months` integer;--> statement-breakpoint
ALTER TABLE `pilot_leads` ADD `preferred_gender` text DEFAULT '不限' NOT NULL;