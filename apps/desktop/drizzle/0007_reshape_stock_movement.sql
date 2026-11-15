-- T075: stock movements get a positive quantity and a direction told by locations (data-model
-- "Target shape"). Every existing movement is translated, never dropped: a negative quantity
-- becomes a positive one leaving the shop floor, a positive one arrives on it. defer_foreign_keys
-- keeps the rebuild safe inside the migration transaction (PRAGMA foreign_keys=OFF does nothing there).
PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
CREATE TABLE `location` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	CONSTRAINT "location_name_len" CHECK(length("location"."name") between 1 and 80),
	CONSTRAINT "location_kind" CHECK("location"."kind" in ('shop_floor','godown'))
);
--> statement-breakpoint
-- The one seeded location for the existing shop. The id is a random UUID (version 4 layout).
INSERT INTO `location` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `name`, `kind`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `business_id`, `shop_id`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'Shop floor', 'shop_floor'
FROM `shop_profile` LIMIT 1;--> statement-breakpoint
CREATE TABLE `__new_stock_movement` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`variant_id` text NOT NULL,
	`movement_type` text NOT NULL,
	`qty_base_milli` integer NOT NULL,
	`from_location_id` text,
	`to_location_id` text,
	`doc_type` text,
	`doc_id` text,
	`reason_code` text,
	`note` text,
	`occurred_at` text NOT NULL,
	`device_id` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_movement_qty_pos" CHECK("__new_stock_movement"."qty_base_milli" > 0),
	CONSTRAINT "stock_movement_type" CHECK("__new_stock_movement"."movement_type" in ('opening','adjustment','sale','sale_cancel')),
	CONSTRAINT "stock_movement_one_direction" CHECK(("__new_stock_movement"."from_location_id" is null) <> ("__new_stock_movement"."to_location_id" is null)),
	CONSTRAINT "stock_movement_doc_pair" CHECK(("__new_stock_movement"."doc_type" is null) = ("__new_stock_movement"."doc_id" is null) and ("__new_stock_movement"."doc_type" is null or "__new_stock_movement"."doc_type" = 'bill')),
	CONSTRAINT "stock_movement_adjustment_note" CHECK("__new_stock_movement"."movement_type" <> 'adjustment' or ("__new_stock_movement"."note" is not null and length(trim("__new_stock_movement"."note")) > 0)),
	CONSTRAINT "stock_movement_note_len" CHECK("__new_stock_movement"."note" is null or length("__new_stock_movement"."note") <= 200)
);
--> statement-breakpoint
-- LEFT JOIN on purpose: a movement with no shop floor to attach to fails the direction check loudly
-- instead of being dropped silently.
INSERT INTO `__new_stock_movement`("id", "business_id", "shop_id", "created_at", "updated_at", "variant_id", "movement_type", "qty_base_milli", "from_location_id", "to_location_id", "doc_type", "doc_id", "reason_code", "note", "occurred_at", "device_id")
SELECT m.`id`, m.`business_id`, m.`shop_id`, m.`created_at`, m.`updated_at`, m.`item_id`, m.`reason`, abs(m.`quantity_milli`),
  CASE WHEN m.`quantity_milli` < 0 THEN shop_floor.`id` END,
  CASE WHEN m.`quantity_milli` > 0 THEN shop_floor.`id` END,
  CASE WHEN m.`bill_id` IS NOT NULL THEN 'bill' END, m.`bill_id`, NULL, m.`note`, m.`occurred_at`, m.`device_id`
FROM `stock_movement` m
LEFT JOIN `location` shop_floor ON shop_floor.`business_id` = m.`business_id` AND shop_floor.`shop_id` = m.`shop_id` AND shop_floor.`kind` = 'shop_floor';--> statement-breakpoint
DROP TABLE `stock_movement`;--> statement-breakpoint
ALTER TABLE `__new_stock_movement` RENAME TO `stock_movement`;--> statement-breakpoint
CREATE INDEX `stock_movement_variant_idx` ON `stock_movement` (`variant_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `stock_movement_doc_idx` ON `stock_movement` (`doc_type`,`doc_id`);--> statement-breakpoint
-- Rebuilding the table dropped its immutability triggers; recreate them (constitution I, II).
CREATE TRIGGER stock_movement_no_update BEFORE UPDATE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
CREATE TRIGGER stock_movement_no_delete BEFORE DELETE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;
