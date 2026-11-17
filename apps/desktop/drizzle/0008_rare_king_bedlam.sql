-- Rebuild to require bill documents exactly for sale and sale_cancel.
PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
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
	CONSTRAINT "stock_movement_doc_pair" CHECK(("__new_stock_movement"."doc_type" is null) = ("__new_stock_movement"."doc_id" is null) and ("__new_stock_movement"."doc_type" is null or "__new_stock_movement"."doc_type" = 'bill') and ("__new_stock_movement"."doc_id" is not null) = ("__new_stock_movement"."movement_type" in ('sale','sale_cancel'))),
	CONSTRAINT "stock_movement_adjustment_note" CHECK("__new_stock_movement"."movement_type" <> 'adjustment' or ("__new_stock_movement"."note" is not null and length(trim("__new_stock_movement"."note")) > 0)),
	CONSTRAINT "stock_movement_note_len" CHECK("__new_stock_movement"."note" is null or length("__new_stock_movement"."note") <= 200)
);
--> statement-breakpoint
INSERT INTO `__new_stock_movement`("id", "business_id", "shop_id", "created_at", "updated_at", "variant_id", "movement_type", "qty_base_milli", "from_location_id", "to_location_id", "doc_type", "doc_id", "reason_code", "note", "occurred_at", "device_id") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "variant_id", "movement_type", "qty_base_milli", "from_location_id", "to_location_id", "doc_type", "doc_id", "reason_code", "note", "occurred_at", "device_id" FROM `stock_movement`;--> statement-breakpoint
DROP TABLE `stock_movement`;--> statement-breakpoint
ALTER TABLE `__new_stock_movement` RENAME TO `stock_movement`;--> statement-breakpoint
CREATE INDEX `stock_movement_variant_idx` ON `stock_movement` (`variant_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `stock_movement_doc_idx` ON `stock_movement` (`doc_type`,`doc_id`);
--> statement-breakpoint
-- Rebuilding drops the append-only triggers; restore both protections.
CREATE TRIGGER stock_movement_no_update BEFORE UPDATE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
CREATE TRIGGER stock_movement_no_delete BEFORE DELETE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;
