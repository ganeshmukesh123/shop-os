-- T078 (first half): number_counter becomes number_series (it also keeps the bill number template),
-- and bill_date (the device's local time, no zone) becomes billed_at (the UTC instant, epoch
-- milliseconds) plus business_date (the calendar date in the shop's zone, worked out once).
-- Every existing counter and bill is copied, never dropped. bill is rebuilt, and bill_line and
-- bill_tender reference it, so foreign keys must be off; migrateConnection switches them off before the
-- migration transaction.
--
-- ASSUMPTION for the old bills: their local time was Asia/Kolkata (UTC+05:30, no daylight saving),
-- the shop's default zone (research D22). billed_at = that wall-clock time minus 19,800 seconds, and
-- business_date is the date part as it was written.
CREATE TABLE `number_series` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`counter_code` text NOT NULL,
	`financial_year` text NOT NULL,
	`template` text NOT NULL,
	`last_seq` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `number_series_uq` ON `number_series` (`shop_id`,`counter_code`,`financial_year`);--> statement-breakpoint
-- One series per existing counter, with the shop's current bill number template. The id is a random
-- UUID (version 4 layout).
INSERT INTO `number_series` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `counter_code`, `financial_year`, `template`, `last_seq`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  c.`business_id`, c.`shop_id`, c.`created_at`, c.`updated_at`, c.`series_code`, c.`financial_year`,
  COALESCE((SELECT p.`number_template` FROM `shop_profile` p WHERE p.`shop_id` = c.`shop_id` LIMIT 1), '{series}/{fy}/{seq}'),
  c.`last_seq`
FROM `number_counter` c;--> statement-breakpoint
-- Safety net: a bill whose counter row is missing still gets a series, so no bill is left without one.
INSERT INTO `number_series` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `counter_code`, `financial_year`, `template`, `last_seq`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  b.`business_id`, b.`shop_id`, min(b.`created_at`), max(b.`updated_at`), b.`counter_code`, b.`financial_year`,
  COALESCE((SELECT p.`number_template` FROM `shop_profile` p WHERE p.`shop_id` = b.`shop_id` LIMIT 1), '{series}/{fy}/{seq}'),
  max(b.`seq`)
FROM `bill` b
WHERE NOT EXISTS (SELECT 1 FROM `number_series` s WHERE s.`shop_id` = b.`shop_id` AND s.`counter_code` = b.`counter_code` AND s.`financial_year` = b.`financial_year`)
GROUP BY b.`business_id`, b.`shop_id`, b.`counter_code`, b.`financial_year`;--> statement-breakpoint
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
	`cancelled_at` text,
	FOREIGN KEY (`number_series_id`) REFERENCES `number_series`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_no_len" CHECK(length("__new_bill"."bill_no") <= 16),
	CONSTRAINT "bill_business_date_format" CHECK("__new_bill"."business_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "bill_status" CHECK("__new_bill"."status" in ('posted','cancelled')),
	CONSTRAINT "bill_cancel_reason_required" CHECK("__new_bill"."status" <> 'cancelled' or ("__new_bill"."cancel_reason" is not null and length(trim("__new_bill"."cancel_reason")) > 0)),
	CONSTRAINT "bill_discount_range" CHECK("__new_bill"."bill_discount_paise" >= 0 and "__new_bill"."bill_discount_paise" <= "__new_bill"."subtotal_paise"),
	CONSTRAINT "bill_total_eq" CHECK("__new_bill"."total_paise" = "__new_bill"."subtotal_paise" - "__new_bill"."bill_discount_paise")
);
--> statement-breakpoint
INSERT INTO `__new_bill`("id", "business_id", "shop_id", "created_at", "updated_at", "device_id", "counter_code", "bill_no", "financial_year", "number_series_id", "seq", "billed_at", "business_date", "customer_name", "client_bill_id", "subtotal_paise", "bill_discount_paise", "total_paise", "status", "cancel_reason", "cancelled_at")
SELECT b.`id`, b.`business_id`, b.`shop_id`, b.`created_at`, b.`updated_at`, b.`device_id`, b.`counter_code`, b.`bill_no`, b.`financial_year`,
  (SELECT s.`id` FROM `number_series` s WHERE s.`shop_id` = b.`shop_id` AND s.`counter_code` = b.`counter_code` AND s.`financial_year` = b.`financial_year`),
  b.`seq`,
  (CAST(strftime('%s', b.`bill_date`) AS INTEGER) - 19800) * 1000,
  substr(b.`bill_date`, 1, 10),
  b.`customer_name`, b.`client_bill_id`, b.`subtotal_paise`, b.`bill_discount_paise`, b.`total_paise`, b.`status`, b.`cancel_reason`, b.`cancelled_at`
FROM `bill` b;--> statement-breakpoint
DROP TABLE `bill`;--> statement-breakpoint
ALTER TABLE `__new_bill` RENAME TO `bill`;--> statement-breakpoint
CREATE UNIQUE INDEX `bill_no_uq` ON `bill` (`shop_id`,`bill_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_counter_fy_seq_uq` ON `bill` (`counter_code`,`financial_year`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_client_bill_id_uq` ON `bill` (`shop_id`,`client_bill_id`);--> statement-breakpoint
CREATE INDEX `bill_business_date_idx` ON `bill` (`business_date`);--> statement-breakpoint
CREATE INDEX `bill_customer_idx` ON `bill` (`customer_name`);--> statement-breakpoint
DROP TABLE `number_counter`;--> statement-breakpoint
-- Rebuilding bill dropped its immutability triggers; recreate them with the new column list
-- (constitution I, II). A posted bill can only move to cancelled, with every other column unchanged.
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
