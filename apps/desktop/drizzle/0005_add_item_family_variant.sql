CREATE TABLE `item_family` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT "item_family_name_len" CHECK(length("item_family"."name") between 1 and 120 and "item_family"."name" = trim("item_family"."name"))
);
--> statement-breakpoint
CREATE TABLE `item_variant` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`family_id` text NOT NULL,
	`item_code` text NOT NULL,
	`display_name` text NOT NULL,
	`base_uom` text NOT NULL,
	`allow_decimal` integer DEFAULT 0 NOT NULL,
	`selling_price_paise` integer NOT NULL,
	`stock_milli` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`hsn_code` text,
	`gst_rate_override_bp` integer,
	`barcode` text,
	FOREIGN KEY (`family_id`) REFERENCES `item_family`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_variant_name_len" CHECK(length("item_variant"."display_name") between 1 and 120 and "item_variant"."display_name" = trim("item_variant"."display_name")),
	CONSTRAINT "item_variant_uom_len" CHECK(length("item_variant"."base_uom") between 1 and 20),
	CONSTRAINT "item_variant_price_nonneg" CHECK("item_variant"."selling_price_paise" >= 0),
	CONSTRAINT "item_variant_allow_decimal_bool" CHECK("item_variant"."allow_decimal" in (0, 1)),
	CONSTRAINT "item_variant_active_bool" CHECK("item_variant"."is_active" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_variant_code_uq` ON `item_variant` (`business_id`,`item_code`);--> statement-breakpoint
CREATE INDEX `item_variant_name_nocase_idx` ON `item_variant` ("display_name" COLLATE NOCASE);--> statement-breakpoint
-- Hand-written (T074): copy every existing item as one family and one variant. Both rows keep the
-- item's id, so stock movements and bill lines keep pointing at the same row once 0006 moves their
-- reference to item_variant. Codes ITM-0001, ITM-0002, ... follow the order the items were created.
INSERT INTO `item_family` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `name`)
SELECT `id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `name` FROM `item`;--> statement-breakpoint
INSERT INTO `item_variant` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `family_id`, `item_code`, `display_name`, `base_uom`, `allow_decimal`, `selling_price_paise`, `stock_milli`, `is_active`, `hsn_code`, `gst_rate_override_bp`, `barcode`)
SELECT `id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `id`,
  'ITM-' || printf('%04d', row_number() OVER (PARTITION BY `business_id` ORDER BY `created_at`, `id`)),
  `name`, `unit`, `allows_decimal`, `price_paise`, `stock_milli`, `active`, `hsn`, `gst_rate_bp`, `barcode`
FROM `item`;