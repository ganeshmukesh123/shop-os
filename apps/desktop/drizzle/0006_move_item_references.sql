-- T074: stock movements and bill lines now reference item_variant (their `item_id` column keeps
-- its name until T075 and T077). Every variant has the id of the item it was copied from in 0005,
-- so the copied rows still point at the same product. `item` is dropped last, once nothing
-- references it. PRAGMA foreign_keys=OFF does nothing inside the migration transaction, so
-- defer_foreign_keys keeps the rebuild safe on a database that already holds bills.
PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
CREATE TABLE `__new_bill_line` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`bill_id` text NOT NULL,
	`line_no` integer NOT NULL,
	`item_id` text NOT NULL,
	`item_name_snapshot` text NOT NULL,
	`unit_snapshot` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`rate_paise` integer NOT NULL,
	`line_discount_paise` integer NOT NULL,
	`amount_paise` integer NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bill`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_line_qty_pos" CHECK("__new_bill_line"."quantity_milli" > 0),
	CONSTRAINT "bill_line_rate_nonneg" CHECK("__new_bill_line"."rate_paise" >= 0),
	CONSTRAINT "bill_line_discount_nonneg" CHECK("__new_bill_line"."line_discount_paise" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_bill_line`("id", "business_id", "shop_id", "created_at", "updated_at", "bill_id", "line_no", "item_id", "item_name_snapshot", "unit_snapshot", "quantity_milli", "rate_paise", "line_discount_paise", "amount_paise") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "bill_id", "line_no", "item_id", "item_name_snapshot", "unit_snapshot", "quantity_milli", "rate_paise", "line_discount_paise", "amount_paise" FROM `bill_line`;--> statement-breakpoint
DROP TABLE `bill_line`;--> statement-breakpoint
ALTER TABLE `__new_bill_line` RENAME TO `bill_line`;--> statement-breakpoint
CREATE INDEX `bill_line_bill_idx` ON `bill_line` (`bill_id`);--> statement-breakpoint
CREATE TABLE `__new_stock_movement` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`bill_id` text,
	`occurred_at` text NOT NULL,
	`device_id` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bill_id`) REFERENCES `bill`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_movement_nonzero" CHECK("__new_stock_movement"."quantity_milli" <> 0),
	CONSTRAINT "stock_movement_reason" CHECK("__new_stock_movement"."reason" in ('opening','adjustment','sale','sale_cancel')),
	CONSTRAINT "stock_movement_note_len" CHECK("__new_stock_movement"."note" is null or length("__new_stock_movement"."note") <= 200)
);
--> statement-breakpoint
INSERT INTO `__new_stock_movement`("id", "business_id", "shop_id", "created_at", "updated_at", "item_id", "quantity_milli", "reason", "note", "bill_id", "occurred_at", "device_id") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "item_id", "quantity_milli", "reason", "note", "bill_id", "occurred_at", "device_id" FROM `stock_movement`;--> statement-breakpoint
DROP TABLE `stock_movement`;--> statement-breakpoint
ALTER TABLE `__new_stock_movement` RENAME TO `stock_movement`;--> statement-breakpoint
CREATE INDEX `stock_movement_item_idx` ON `stock_movement` (`item_id`,`occurred_at`);--> statement-breakpoint
-- Rebuilding the two tables dropped their immutability triggers; recreate them (constitution I, II).
CREATE TRIGGER stock_movement_no_update BEFORE UPDATE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
CREATE TRIGGER stock_movement_no_delete BEFORE DELETE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
CREATE TRIGGER bill_line_no_update BEFORE UPDATE ON bill_line
BEGIN SELECT RAISE(ABORT, 'bill_line is immutable'); END;--> statement-breakpoint
CREATE TRIGGER bill_line_no_delete BEFORE DELETE ON bill_line
BEGIN SELECT RAISE(ABORT, 'bill_line is immutable'); END;--> statement-breakpoint
DROP TABLE `item`;
