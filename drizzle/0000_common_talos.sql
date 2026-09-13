CREATE TABLE `bookmarks` (
	`session_key` text NOT NULL,
	`item_key` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`session_key`, `item_key`)
);
--> statement-breakpoint
CREATE TABLE `reflections` (
	`session_key` text PRIMARY KEY NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
