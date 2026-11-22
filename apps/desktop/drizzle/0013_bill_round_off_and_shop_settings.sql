-- T080: the bill gets round_off_paise (default 0) and doc_title (default 'Estimate'), and its total check
-- becomes total = subtotal - discount + round_off with abs(round_off) <= 50. shop_profile gets
-- doc_title, round_bill_total (default on) and time_zone (default Asia/Kolkata), and its receipt_width
-- check accepts a4 and a5. SQLite cannot change a CHECK, so both tables are rebuilt and every row is
-- copied; the new columns take their defaults (existing bills have round-off 0, so
-- total = subtotal - discount still holds). The bill also gets time_zone, the shop's zone when it was
-- saved, so its date and time never move when the shop changes its zone; every earlier bill was saved
-- in the default zone, Asia/Kolkata. migrateConnection switches foreign keys off before the
-- migration transaction and runs foreign_key_check after it.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`round_off_paise` integer DEFAULT 0 NOT NULL,
	`total_paise` integer NOT NULL,
	`doc_title` text DEFAULT 'Estimate' NOT NULL,
	`time_zone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`status` text NOT NULL,
	`cancel_reason` text,
	`cancelled_at` integer,
	FOREIGN KEY (`number_series_id`) REFERENCES `number_series`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_no_len" CHECK(length("__new_bill"."bill_no") <= 16),
	CONSTRAINT "bill_business_date_format" CHECK("__new_bill"."business_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "bill_status" CHECK("__new_bill"."status" in ('posted','cancelled')),
	CONSTRAINT "bill_cancel_reason_required" CHECK("__new_bill"."status" <> 'cancelled' or ("__new_bill"."cancel_reason" is not null and length(trim("__new_bill"."cancel_reason")) > 0)),
	CONSTRAINT "bill_discount_range" CHECK("__new_bill"."bill_discount_paise" >= 0 and "__new_bill"."bill_discount_paise" <= "__new_bill"."subtotal_paise"),
	CONSTRAINT "bill_round_off_range" CHECK(abs("__new_bill"."round_off_paise") <= 50),
	CONSTRAINT "bill_total_eq" CHECK("__new_bill"."total_paise" = "__new_bill"."subtotal_paise" - "__new_bill"."bill_discount_paise" + "__new_bill"."round_off_paise"),
	CONSTRAINT "bill_doc_title_len" CHECK(length(trim("__new_bill"."doc_title")) between 1 and 30),
	CONSTRAINT "bill_time_zone_len" CHECK(length("__new_bill"."time_zone") between 1 and 64)
);
--> statement-breakpoint
INSERT INTO `__new_bill`("id", "business_id", "shop_id", "created_at", "updated_at", "device_id", "counter_code", "bill_no", "financial_year", "number_series_id", "seq", "billed_at", "business_date", "customer_name", "client_bill_id", "subtotal_paise", "bill_discount_paise", "total_paise", "status", "cancel_reason", "cancelled_at") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "device_id", "counter_code", "bill_no", "financial_year", "number_series_id", "seq", "billed_at", "business_date", "customer_name", "client_bill_id", "subtotal_paise", "bill_discount_paise", "total_paise", "status", "cancel_reason", "cancelled_at" FROM `bill`;--> statement-breakpoint
DROP TABLE `bill`;--> statement-breakpoint
ALTER TABLE `__new_bill` RENAME TO `bill`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `bill_no_uq` ON `bill` (`shop_id`,`bill_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_counter_fy_seq_uq` ON `bill` (`counter_code`,`financial_year`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_client_bill_id_uq` ON `bill` (`shop_id`,`client_bill_id`);--> statement-breakpoint
CREATE INDEX `bill_business_date_idx` ON `bill` (`business_date`);--> statement-breakpoint
CREATE INDEX `bill_customer_idx` ON `bill` (`customer_name`);--> statement-breakpoint
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
	CONSTRAINT "shop_profile_name_len" CHECK(length("__new_shop_profile"."name") between 1 and 80),
	CONSTRAINT "shop_profile_address_len" CHECK(length("__new_shop_profile"."address") <= 200),
	CONSTRAINT "shop_profile_phone_len" CHECK(length("__new_shop_profile"."phone") <= 20),
	CONSTRAINT "shop_profile_footer_len" CHECK(length("__new_shop_profile"."footer") <= 200),
	CONSTRAINT "shop_profile_width" CHECK("__new_shop_profile"."receipt_width" in ('58mm','80mm','a4','a5')),
	CONSTRAINT "shop_profile_doc_title_len" CHECK(length(trim("__new_shop_profile"."doc_title")) between 1 and 30),
	CONSTRAINT "shop_profile_round_bool" CHECK("__new_shop_profile"."round_bill_total" in (0, 1)),
	CONSTRAINT "shop_profile_time_zone_len" CHECK(length("__new_shop_profile"."time_zone") between 1 and 64)
);
--> statement-breakpoint
INSERT INTO `__new_shop_profile`("id", "business_id", "shop_id", "created_at", "updated_at", "name", "address", "phone", "series_code", "number_template", "footer", "receipt_width", "backup_folder", "device_id") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "name", "address", "phone", "series_code", "number_template", "footer", "receipt_width", "backup_folder", "device_id" FROM `shop_profile`;--> statement-breakpoint
DROP TABLE `shop_profile`;--> statement-breakpoint
ALTER TABLE `__new_shop_profile` RENAME TO `shop_profile`;--> statement-breakpoint
-- Rebuilding `bill` dropped its immutability triggers; recreate them (constitution I, II). A posted
-- bill can only move to cancelled, with every other column unchanged, including the three new ones and
-- the shop, business and creation time, which the earlier trigger did not check.
CREATE TRIGGER bill_no_delete BEFORE DELETE ON bill
BEGIN SELECT RAISE(ABORT, 'bills cannot be deleted'); END;--> statement-breakpoint
CREATE TRIGGER bill_only_cancel_update BEFORE UPDATE ON bill
WHEN NOT (
  OLD.status = 'posted' AND NEW.status = 'cancelled'
  AND NEW.id = OLD.id AND NEW.business_id = OLD.business_id AND NEW.shop_id = OLD.shop_id
  AND NEW.created_at = OLD.created_at AND NEW.device_id = OLD.device_id AND NEW.counter_code = OLD.counter_code
  AND NEW.bill_no = OLD.bill_no AND NEW.financial_year = OLD.financial_year
  AND NEW.number_series_id = OLD.number_series_id AND NEW.seq = OLD.seq
  AND NEW.billed_at = OLD.billed_at AND NEW.business_date = OLD.business_date
  AND NEW.customer_name IS OLD.customer_name AND NEW.client_bill_id IS OLD.client_bill_id
  AND NEW.subtotal_paise = OLD.subtotal_paise AND NEW.bill_discount_paise = OLD.bill_discount_paise
  AND NEW.round_off_paise = OLD.round_off_paise AND NEW.total_paise = OLD.total_paise
  AND NEW.doc_title = OLD.doc_title AND NEW.time_zone = OLD.time_zone
)
BEGIN SELECT RAISE(ABORT, 'a saved bill can only be cancelled, not edited'); END;