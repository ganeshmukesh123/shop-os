-- T078 (second half): every time column becomes an INTEGER of epoch milliseconds (UTC) instead of
-- ISO-8601 text: created_at and updated_at on every table, stock_movement.occurred_at and
-- bill.cancelled_at. SQLite cannot change a column's type, so all eleven tables are rebuilt and every
-- row is copied, never dropped. The text is converted exactly to the millisecond:
-- strftime('%s', t) * 1000 plus the three digits after the dot of strftime('%f', t).
-- backup_log.started_at and finished_at stay ISO text (the owner reads them as text).
-- Foreign keys must be off for the rebuilds; migrateConnection switches them off before the migration
-- transaction and runs foreign_key_check afterwards.
CREATE TABLE `__new_backup_log` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`path` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`error` text,
	CONSTRAINT "backup_log_status" CHECK("__new_backup_log"."status" in ('ok','failed'))
);
--> statement-breakpoint
INSERT INTO `__new_backup_log`("id", "business_id", "shop_id", "created_at", "updated_at", "path", "started_at", "finished_at", "status", "error") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "path", "started_at", "finished_at", "status", "error" FROM `backup_log`;--> statement-breakpoint
DROP TABLE `backup_log`;--> statement-breakpoint
ALTER TABLE `__new_backup_log` RENAME TO `backup_log`;--> statement-breakpoint
CREATE TABLE `__new_bill` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`device_id` text NOT NULL,
	`counter_code` text NOT NULL,
	`bill_no` text NOT NULL,
	`financial_year` text NOT NULL,
	`number_series_id` text NOT NULL,
	`seq` integer NOT NULL,
	`billed_at` integer NOT NULL,
	`business_date` text NOT NULL,
	`customer_name` text,
	`client_bill_id` text,
	`subtotal_paise` integer NOT NULL,
	`bill_discount_paise` integer NOT NULL,
	`total_paise` integer NOT NULL,
	`status` text NOT NULL,
	`cancel_reason` text,
	`cancelled_at` integer,
	FOREIGN KEY (`number_series_id`) REFERENCES `number_series`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_no_len" CHECK(length("__new_bill"."bill_no") <= 16),
	CONSTRAINT "bill_business_date_format" CHECK("__new_bill"."business_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "bill_status" CHECK("__new_bill"."status" in ('posted','cancelled')),
	CONSTRAINT "bill_cancel_reason_required" CHECK("__new_bill"."status" <> 'cancelled' or ("__new_bill"."cancel_reason" is not null and length(trim("__new_bill"."cancel_reason")) > 0)),
	CONSTRAINT "bill_discount_range" CHECK("__new_bill"."bill_discount_paise" >= 0 and "__new_bill"."bill_discount_paise" <= "__new_bill"."subtotal_paise"),
	CONSTRAINT "bill_total_eq" CHECK("__new_bill"."total_paise" = "__new_bill"."subtotal_paise" - "__new_bill"."bill_discount_paise")
);
--> statement-breakpoint
INSERT INTO `__new_bill`("id", "business_id", "shop_id", "created_at", "updated_at", "device_id", "counter_code", "bill_no", "financial_year", "number_series_id", "seq", "billed_at", "business_date", "customer_name", "client_bill_id", "subtotal_paise", "bill_discount_paise", "total_paise", "status", "cancel_reason", "cancelled_at") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "device_id", "counter_code", "bill_no", "financial_year", "number_series_id", "seq", "billed_at", "business_date", "customer_name", "client_bill_id", "subtotal_paise", "bill_discount_paise", "total_paise", "status", "cancel_reason", CASE WHEN "cancelled_at" IS NULL THEN NULL ELSE (CAST(strftime('%s', "cancelled_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "cancelled_at"), 4) AS INTEGER)) END FROM `bill`;--> statement-breakpoint
DROP TABLE `bill`;--> statement-breakpoint
ALTER TABLE `__new_bill` RENAME TO `bill`;--> statement-breakpoint
CREATE UNIQUE INDEX `bill_no_uq` ON `bill` (`shop_id`,`bill_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_counter_fy_seq_uq` ON `bill` (`counter_code`,`financial_year`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_client_bill_id_uq` ON `bill` (`shop_id`,`client_bill_id`);--> statement-breakpoint
CREATE INDEX `bill_business_date_idx` ON `bill` (`business_date`);--> statement-breakpoint
CREATE INDEX `bill_customer_idx` ON `bill` (`customer_name`);--> statement-breakpoint
CREATE TABLE `__new_bill_line` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
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
INSERT INTO `__new_bill_line`("id", "business_id", "shop_id", "created_at", "updated_at", "bill_id", "line_no", "variant_id", "item_name_snapshot", "unit_snapshot", "qty_base_milli", "unit_price_paise", "line_discount_paise", "amount_paise") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "bill_id", "line_no", "variant_id", "item_name_snapshot", "unit_snapshot", "qty_base_milli", "unit_price_paise", "line_discount_paise", "amount_paise" FROM `bill_line`;--> statement-breakpoint
DROP TABLE `bill_line`;--> statement-breakpoint
ALTER TABLE `__new_bill_line` RENAME TO `bill_line`;--> statement-breakpoint
CREATE INDEX `bill_line_bill_idx` ON `bill_line` (`bill_id`);--> statement-breakpoint
CREATE TABLE `__new_bill_tender` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`bill_id` text NOT NULL,
	`mode` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bill`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_tender_mode" CHECK("__new_bill_tender"."mode" in ('cash','upi','card','unpaid')),
	CONSTRAINT "bill_tender_amount_nonneg" CHECK("__new_bill_tender"."amount_paise" >= 0),
	CONSTRAINT "bill_tender_status" CHECK("__new_bill_tender"."status" in ('label'))
);
--> statement-breakpoint
INSERT INTO `__new_bill_tender`("id", "business_id", "shop_id", "created_at", "updated_at", "bill_id", "mode", "amount_paise", "status") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "bill_id", "mode", "amount_paise", "status" FROM `bill_tender`;--> statement-breakpoint
DROP TABLE `bill_tender`;--> statement-breakpoint
ALTER TABLE `__new_bill_tender` RENAME TO `bill_tender`;--> statement-breakpoint
CREATE INDEX `bill_tender_bill_idx` ON `bill_tender` (`bill_id`);--> statement-breakpoint
CREATE TABLE `__new_draft_bill` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_draft_bill`("id", "business_id", "shop_id", "created_at", "updated_at", "payload") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "payload" FROM `draft_bill`;--> statement-breakpoint
DROP TABLE `draft_bill`;--> statement-breakpoint
ALTER TABLE `__new_draft_bill` RENAME TO `draft_bill`;--> statement-breakpoint
CREATE TABLE `__new_item_family` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT "item_family_name_len" CHECK(length("__new_item_family"."name") between 1 and 120 and "__new_item_family"."name" = trim("__new_item_family"."name"))
);
--> statement-breakpoint
INSERT INTO `__new_item_family`("id", "business_id", "shop_id", "created_at", "updated_at", "name") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "name" FROM `item_family`;--> statement-breakpoint
DROP TABLE `item_family`;--> statement-breakpoint
ALTER TABLE `__new_item_family` RENAME TO `item_family`;--> statement-breakpoint
CREATE TABLE `__new_item_variant` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
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
	CONSTRAINT "item_variant_name_len" CHECK(length("__new_item_variant"."display_name") between 1 and 120 and "__new_item_variant"."display_name" = trim("__new_item_variant"."display_name")),
	CONSTRAINT "item_variant_uom_len" CHECK(length("__new_item_variant"."base_uom") between 1 and 20),
	CONSTRAINT "item_variant_price_nonneg" CHECK("__new_item_variant"."selling_price_paise" >= 0),
	CONSTRAINT "item_variant_allow_decimal_bool" CHECK("__new_item_variant"."allow_decimal" in (0, 1)),
	CONSTRAINT "item_variant_active_bool" CHECK("__new_item_variant"."is_active" in (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_item_variant`("id", "business_id", "shop_id", "created_at", "updated_at", "family_id", "item_code", "display_name", "base_uom", "allow_decimal", "selling_price_paise", "stock_milli", "is_active", "hsn_code", "gst_rate_override_bp", "barcode") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "family_id", "item_code", "display_name", "base_uom", "allow_decimal", "selling_price_paise", "stock_milli", "is_active", "hsn_code", "gst_rate_override_bp", "barcode" FROM `item_variant`;--> statement-breakpoint
DROP TABLE `item_variant`;--> statement-breakpoint
ALTER TABLE `__new_item_variant` RENAME TO `item_variant`;--> statement-breakpoint
CREATE UNIQUE INDEX `item_variant_code_uq` ON `item_variant` (`business_id`,`item_code`);--> statement-breakpoint
CREATE INDEX `item_variant_name_nocase_idx` ON `item_variant` ("display_name" COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `__new_location` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	CONSTRAINT "location_name_len" CHECK(length("__new_location"."name") between 1 and 80),
	CONSTRAINT "location_kind" CHECK("__new_location"."kind" in ('shop_floor','godown'))
);
--> statement-breakpoint
INSERT INTO `__new_location`("id", "business_id", "shop_id", "created_at", "updated_at", "name", "kind") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "name", "kind" FROM `location`;--> statement-breakpoint
DROP TABLE `location`;--> statement-breakpoint
ALTER TABLE `__new_location` RENAME TO `location`;--> statement-breakpoint
CREATE TABLE `__new_number_series` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`counter_code` text NOT NULL,
	`financial_year` text NOT NULL,
	`template` text NOT NULL,
	`last_seq` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_number_series`("id", "business_id", "shop_id", "created_at", "updated_at", "counter_code", "financial_year", "template", "last_seq") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "counter_code", "financial_year", "template", "last_seq" FROM `number_series`;--> statement-breakpoint
DROP TABLE `number_series`;--> statement-breakpoint
ALTER TABLE `__new_number_series` RENAME TO `number_series`;--> statement-breakpoint
CREATE UNIQUE INDEX `number_series_uq` ON `number_series` (`shop_id`,`counter_code`,`financial_year`);--> statement-breakpoint
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
	CONSTRAINT "shop_profile_name_len" CHECK(length("__new_shop_profile"."name") between 1 and 80),
	CONSTRAINT "shop_profile_address_len" CHECK(length("__new_shop_profile"."address") <= 200),
	CONSTRAINT "shop_profile_phone_len" CHECK(length("__new_shop_profile"."phone") <= 20),
	CONSTRAINT "shop_profile_footer_len" CHECK(length("__new_shop_profile"."footer") <= 200),
	CONSTRAINT "shop_profile_width" CHECK("__new_shop_profile"."receipt_width" in ('58mm','80mm'))
);
--> statement-breakpoint
INSERT INTO `__new_shop_profile`("id", "business_id", "shop_id", "created_at", "updated_at", "name", "address", "phone", "series_code", "number_template", "footer", "receipt_width", "backup_folder", "device_id") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "name", "address", "phone", "series_code", "number_template", "footer", "receipt_width", "backup_folder", "device_id" FROM `shop_profile`;--> statement-breakpoint
DROP TABLE `shop_profile`;--> statement-breakpoint
ALTER TABLE `__new_shop_profile` RENAME TO `shop_profile`;--> statement-breakpoint
CREATE TABLE `__new_stock_movement` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`variant_id` text NOT NULL,
	`movement_type` text NOT NULL,
	`qty_base_milli` integer NOT NULL,
	`from_location_id` text,
	`to_location_id` text,
	`doc_type` text,
	`doc_id` text,
	`reason_code` text,
	`note` text,
	`occurred_at` integer NOT NULL,
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
INSERT INTO `__new_stock_movement`("id", "business_id", "shop_id", "created_at", "updated_at", "variant_id", "movement_type", "qty_base_milli", "from_location_id", "to_location_id", "doc_type", "doc_id", "reason_code", "note", "occurred_at", "device_id") SELECT "id", "business_id", "shop_id", (CAST(strftime('%s', "created_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "created_at"), 4) AS INTEGER)), (CAST(strftime('%s', "updated_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "updated_at"), 4) AS INTEGER)), "variant_id", "movement_type", "qty_base_milli", "from_location_id", "to_location_id", "doc_type", "doc_id", "reason_code", "note", (CAST(strftime('%s', "occurred_at") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "occurred_at"), 4) AS INTEGER)), "device_id" FROM `stock_movement`;--> statement-breakpoint
DROP TABLE `stock_movement`;--> statement-breakpoint
ALTER TABLE `__new_stock_movement` RENAME TO `stock_movement`;--> statement-breakpoint
CREATE INDEX `stock_movement_variant_idx` ON `stock_movement` (`variant_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `stock_movement_doc_idx` ON `stock_movement` (`doc_type`,`doc_id`);--> statement-breakpoint
-- Rebuilding stock_movement, bill_line, bill_tender and bill dropped their immutability triggers;
-- recreate them (constitution I, II). A posted bill can only move to cancelled, with every other
-- column unchanged.
CREATE TRIGGER stock_movement_no_update BEFORE UPDATE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
CREATE TRIGGER stock_movement_no_delete BEFORE DELETE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
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
  AND NEW.bill_no = OLD.bill_no AND NEW.financial_year = OLD.financial_year
  AND NEW.number_series_id = OLD.number_series_id AND NEW.seq = OLD.seq
  AND NEW.billed_at = OLD.billed_at AND NEW.business_date = OLD.business_date
  AND NEW.customer_name IS OLD.customer_name AND NEW.client_bill_id IS OLD.client_bill_id
  AND NEW.subtotal_paise = OLD.subtotal_paise AND NEW.bill_discount_paise = OLD.bill_discount_paise
  AND NEW.total_paise = OLD.total_paise
)
BEGIN SELECT RAISE(ABORT, 'a saved bill can only be cancelled, not edited'); END;
