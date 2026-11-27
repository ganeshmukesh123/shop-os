CREATE TABLE `item_barcode` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`variant_id` text NOT NULL,
	`code` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_barcode_code_chars" CHECK(length("item_barcode"."code") between 1 and 48 and "item_barcode"."code" not glob '*[^0-9A-Za-z-]*'),
	CONSTRAINT "item_barcode_source_enum" CHECK("item_barcode"."source" in ('manufacturer', 'shop_label'))
);
--> statement-breakpoint
CREATE INDEX `item_barcode_code_idx` ON `item_barcode` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_barcode_variant_code_uq` ON `item_barcode` (`variant_id`,`code`);--> statement-breakpoint
CREATE TABLE `item_batch` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`variant_id` text NOT NULL,
	`batch_code` text,
	`mrp_paise` integer NOT NULL,
	`landed_cost_paise` integer,
	`received_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_batch_mrp_pos" CHECK("item_batch"."mrp_paise" > 0),
	CONSTRAINT "item_batch_code_len" CHECK("item_batch"."batch_code" is null or length("item_batch"."batch_code") <= 30),
	CONSTRAINT "item_batch_landed_cost_nonneg" CHECK("item_batch"."landed_cost_paise" is null or "item_batch"."landed_cost_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX `item_batch_variant_received_idx` ON `item_batch` (`variant_id`,`received_at`);--> statement-breakpoint
CREATE TABLE `item_price` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`variant_id` text NOT NULL,
	`tier_id` text NOT NULL,
	`price_paise` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tier_id`) REFERENCES `price_tier`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_price_nonneg" CHECK("item_price"."price_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_price_variant_tier_uq` ON `item_price` (`variant_id`,`tier_id`);--> statement-breakpoint
CREATE TABLE `item_sales_stat` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`variant_id` text NOT NULL,
	`sold_qty_90d_milli` integer DEFAULT 0 NOT NULL,
	`bill_count_90d` integer DEFAULT 0 NOT NULL,
	`last_sold_at` integer,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_sales_stat_bill_count_nonneg" CHECK("item_sales_stat"."bill_count_90d" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_sales_stat_variant_uq` ON `item_sales_stat` (`variant_id`);--> statement-breakpoint
CREATE TABLE `item_search_name` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`variant_id` text NOT NULL,
	`name` text NOT NULL,
	`language` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_search_name_len" CHECK(length("item_search_name"."name") between 1 and 80 and "item_search_name"."name" = trim("item_search_name"."name")),
	CONSTRAINT "item_search_name_language_enum" CHECK("item_search_name"."language" in ('en', 'hi', 'hinglish')),
	CONSTRAINT "item_search_name_kind_enum" CHECK("item_search_name"."kind" in ('alias', 'trade', 'spelling'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_search_name_variant_name_nocase_uq` ON `item_search_name` (`variant_id`,"name" COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `price_tier` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "price_tier_default_bool" CHECK("price_tier"."is_default" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_tier_business_code_uq` ON `price_tier` (`business_id`,`code`);--> statement-breakpoint
CREATE TABLE `unit_conversion` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`variant_id` text NOT NULL,
	`uom_code` text NOT NULL,
	`factor_milli` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`,`uom_code`) REFERENCES `uom`(`business_id`,`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "unit_conversion_factor_pos" CHECK("unit_conversion"."factor_milli" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unit_conversion_variant_uom_uq` ON `unit_conversion` (`variant_id`,`uom_code`);--> statement-breakpoint
-- Hand-written (spec 002 T018): seed the price tiers for a shop that already exists. A new
-- database has no shop yet, so this selects nothing and seed.ts inserts the same rows.
INSERT INTO `price_tier` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `code`, `label`, `is_default`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `shop_profile`.`business_id`, `shop_profile`.`shop_id`,
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  `seeded`.`column1`, `seeded`.`column2`, `seeded`.`column3`
FROM `shop_profile` CROSS JOIN (VALUES
  ('retail', 'Retail', 1), ('contractor', 'Contractor', 0), ('dealer', 'Dealer', 0)
) AS `seeded`;--> statement-breakpoint
-- Hand-written (spec 002 T018): a 001 item's barcode becomes its first item_barcode row, as the
-- maker's code. The old column stays and is no longer read (research D7). Only a code the new
-- CHECK accepts is copied: one bad old value must not stop the shop's upgrade; it stays in the
-- old column for the owner to re-enter.
INSERT INTO `item_barcode` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `variant_id`, `code`, `source`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `business_id`, `shop_id`, `created_at`, `updated_at`, `id`, trim(`barcode`), 'manufacturer'
FROM `item_variant`
WHERE `barcode` IS NOT NULL
  AND length(trim(`barcode`)) BETWEEN 1 AND 48
  AND trim(`barcode`) NOT GLOB '*[^0-9A-Za-z-]*';