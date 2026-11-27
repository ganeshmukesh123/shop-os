-- Hand-edited (spec 018 T035): drizzle-kit generated `SELECT ..., "theme" FROM shop_profile`, a column
-- the old table does not have, which fails every upgrade. The new column starts as NULL instead.
-- Covered by tests/integration/themeColumnUpgrade.test.ts.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_shop_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`series_code` text DEFAULT 'C1' NOT NULL,
	`number_template` text DEFAULT '{series}/{fy}/{seq}' NOT NULL,
	`footer` text DEFAULT '' NOT NULL,
	`receipt_width` text DEFAULT '80mm' NOT NULL,
	`backup_folder` text DEFAULT '' NOT NULL,
	`device_id` text NOT NULL,
	`doc_title` text DEFAULT 'Estimate' NOT NULL,
	`round_bill_total` integer DEFAULT 1 NOT NULL,
	`time_zone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`theme` text,
	CONSTRAINT "shop_profile_name_len" CHECK(length("__new_shop_profile"."name") between 1 and 80),
	CONSTRAINT "shop_profile_address_len" CHECK(length("__new_shop_profile"."address") <= 200),
	CONSTRAINT "shop_profile_phone_len" CHECK(length("__new_shop_profile"."phone") <= 20),
	CONSTRAINT "shop_profile_footer_len" CHECK(length("__new_shop_profile"."footer") <= 200),
	CONSTRAINT "shop_profile_width" CHECK("__new_shop_profile"."receipt_width" in ('58mm','80mm','a4','a5')),
	CONSTRAINT "shop_profile_doc_title_len" CHECK(length(trim("__new_shop_profile"."doc_title")) between 1 and 30),
	CONSTRAINT "shop_profile_round_bool" CHECK("__new_shop_profile"."round_bill_total" in (0, 1)),
	CONSTRAINT "shop_profile_time_zone_len" CHECK(length("__new_shop_profile"."time_zone") between 1 and 64),
	CONSTRAINT "shop_profile_theme" CHECK("__new_shop_profile"."theme" is null or "__new_shop_profile"."theme" in ('system','light','dark'))
);
--> statement-breakpoint
INSERT INTO `__new_shop_profile`("id", "business_id", "shop_id", "created_at", "updated_at", "name", "address", "phone", "series_code", "number_template", "footer", "receipt_width", "backup_folder", "device_id", "doc_title", "round_bill_total", "time_zone", "theme") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "name", "address", "phone", "series_code", "number_template", "footer", "receipt_width", "backup_folder", "device_id", "doc_title", "round_bill_total", "time_zone", NULL FROM `shop_profile`;--> statement-breakpoint
DROP TABLE `shop_profile`;--> statement-breakpoint
ALTER TABLE `__new_shop_profile` RENAME TO `shop_profile`;--> statement-breakpoint
PRAGMA foreign_keys=ON;