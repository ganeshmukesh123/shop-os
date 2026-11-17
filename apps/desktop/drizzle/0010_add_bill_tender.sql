-- T077: the payment mode moves from the bill into its own append-only bill_tender row, and the
-- bill line takes the target names: item_id -> variant_id, quantity_milli -> qty_base_milli,
-- rate_paise -> unit_price_paise. Every existing bill gets one tender (its old payment mode, the
-- whole total, status 'label'); every existing line is copied. bill and bill_line are rebuilt, so
-- foreign keys must be off; migrateConnection switches them off before the migration transaction.
CREATE TABLE `bill_tender` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`bill_id` text NOT NULL,
	`mode` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bill`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_tender_mode" CHECK("bill_tender"."mode" in ('cash','upi','card','unpaid')),
	CONSTRAINT "bill_tender_amount_nonneg" CHECK("bill_tender"."amount_paise" >= 0),
	CONSTRAINT "bill_tender_status" CHECK("bill_tender"."status" in ('label'))
);
--> statement-breakpoint
CREATE INDEX `bill_tender_bill_idx` ON `bill_tender` (`bill_id`);--> statement-breakpoint
-- One tender per existing bill, read before bill loses its payment_mode column. The id is a random
-- UUID (version 4 layout).
INSERT INTO `bill_tender` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `bill_id`, `mode`, `amount_paise`, `status`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `business_id`, `shop_id`, `created_at`, `updated_at`, `id`, `payment_mode`, `total_paise`, 'label'
FROM `bill`;--> statement-breakpoint
CREATE TABLE `__new_bill_line` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`bill_id` text NOT NULL,
	`line_no` integer NOT NULL,
	`variant_id` text NOT NULL,
	`item_name_snapshot` text NOT NULL,
	`unit_snapshot` text NOT NULL,
	`qty_base_milli` integer NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`line_discount_paise` integer NOT NULL,
	`amount_paise` integer NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bill`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_line_qty_pos" CHECK("__new_bill_line"."qty_base_milli" > 0),
	CONSTRAINT "bill_line_price_nonneg" CHECK("__new_bill_line"."unit_price_paise" >= 0),
	CONSTRAINT "bill_line_discount_nonneg" CHECK("__new_bill_line"."line_discount_paise" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_bill_line`("id", "business_id", "shop_id", "created_at", "updated_at", "bill_id", "line_no", "variant_id", "item_name_snapshot", "unit_snapshot", "qty_base_milli", "unit_price_paise", "line_discount_paise", "amount_paise")
SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "bill_id", "line_no", "item_id", "item_name_snapshot", "unit_snapshot", "quantity_milli", "rate_paise", "line_discount_paise", "amount_paise" FROM `bill_line`;--> statement-breakpoint
DROP TABLE `bill_line`;--> statement-breakpoint
ALTER TABLE `__new_bill_line` RENAME TO `bill_line`;--> statement-breakpoint
CREATE INDEX `bill_line_bill_idx` ON `bill_line` (`bill_id`);--> statement-breakpoint
CREATE TABLE `__new_bill` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`device_id` text NOT NULL,
	`counter_code` text NOT NULL,
	`bill_no` text NOT NULL,
	`financial_year` text NOT NULL,
	`seq` integer NOT NULL,
	`bill_date` text NOT NULL,
	`customer_name` text,
	`client_bill_id` text,
	`subtotal_paise` integer NOT NULL,
	`bill_discount_paise` integer NOT NULL,
	`total_paise` integer NOT NULL,
	`status` text NOT NULL,
	`cancel_reason` text,
	`cancelled_at` text,
	CONSTRAINT "bill_no_len" CHECK(length("__new_bill"."bill_no") <= 16),
	CONSTRAINT "bill_status" CHECK("__new_bill"."status" in ('posted','cancelled')),
	CONSTRAINT "bill_cancel_reason_required" CHECK("__new_bill"."status" <> 'cancelled' or ("__new_bill"."cancel_reason" is not null and length(trim("__new_bill"."cancel_reason")) > 0)),
	CONSTRAINT "bill_discount_range" CHECK("__new_bill"."bill_discount_paise" >= 0 and "__new_bill"."bill_discount_paise" <= "__new_bill"."subtotal_paise"),
	CONSTRAINT "bill_total_eq" CHECK("__new_bill"."total_paise" = "__new_bill"."subtotal_paise" - "__new_bill"."bill_discount_paise")
);
--> statement-breakpoint
INSERT INTO `__new_bill`("id", "business_id", "shop_id", "created_at", "updated_at", "device_id", "counter_code", "bill_no", "financial_year", "seq", "bill_date", "customer_name", "client_bill_id", "subtotal_paise", "bill_discount_paise", "total_paise", "status", "cancel_reason", "cancelled_at")
SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "device_id", "counter_code", "bill_no", "financial_year", "seq", "bill_date", "customer_name", "client_bill_id", "subtotal_paise", "bill_discount_paise", "total_paise", "status", "cancel_reason", "cancelled_at" FROM `bill`;--> statement-breakpoint
DROP TABLE `bill`;--> statement-breakpoint
ALTER TABLE `__new_bill` RENAME TO `bill`;--> statement-breakpoint
CREATE UNIQUE INDEX `bill_no_uq` ON `bill` (`shop_id`,`bill_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_counter_fy_seq_uq` ON `bill` (`counter_code`,`financial_year`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_client_bill_id_uq` ON `bill` (`shop_id`,`client_bill_id`);--> statement-breakpoint
CREATE INDEX `bill_date_idx` ON `bill` (`bill_date`);--> statement-breakpoint
CREATE INDEX `bill_customer_idx` ON `bill` (`customer_name`);--> statement-breakpoint
-- Rebuilding bill and bill_line dropped their immutability triggers; recreate them, and add the
-- same protection for bill_tender (constitution I, II). payment_mode is gone from the bill's
-- "unchanged" list because the column is gone.
CREATE TRIGGER bill_line_no_update BEFORE UPDATE ON bill_line
BEGIN SELECT RAISE(ABORT, 'bill_line is immutable'); END;--> statement-breakpoint
CREATE TRIGGER bill_line_no_delete BEFORE DELETE ON bill_line
BEGIN SELECT RAISE(ABORT, 'bill_line is immutable'); END;--> statement-breakpoint
CREATE TRIGGER bill_tender_no_update BEFORE UPDATE ON bill_tender
BEGIN SELECT RAISE(ABORT, 'bill_tender is immutable'); END;--> statement-breakpoint
CREATE TRIGGER bill_tender_no_delete BEFORE DELETE ON bill_tender
BEGIN SELECT RAISE(ABORT, 'bill_tender is immutable'); END;--> statement-breakpoint
CREATE TRIGGER bill_no_delete BEFORE DELETE ON bill
BEGIN SELECT RAISE(ABORT, 'bills cannot be deleted'); END;--> statement-breakpoint
CREATE TRIGGER bill_only_cancel_update BEFORE UPDATE ON bill
WHEN NOT (
  OLD.status = 'posted' AND NEW.status = 'cancelled'
  AND NEW.id = OLD.id AND NEW.device_id = OLD.device_id AND NEW.counter_code = OLD.counter_code
  AND NEW.bill_no = OLD.bill_no AND NEW.financial_year = OLD.financial_year AND NEW.seq = OLD.seq
  AND NEW.bill_date = OLD.bill_date AND NEW.customer_name IS OLD.customer_name
  AND NEW.client_bill_id IS OLD.client_bill_id
  AND NEW.subtotal_paise = OLD.subtotal_paise AND NEW.bill_discount_paise = OLD.bill_discount_paise
  AND NEW.total_paise = OLD.total_paise
)
BEGIN SELECT RAISE(ABORT, 'a saved bill can only be cancelled, not edited'); END;
