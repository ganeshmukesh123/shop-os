-- T076: the bill header takes the names of the target shape (data-model.md): number -> bill_no,
-- series_code -> counter_code, lines_total_paise -> subtotal_paise, grand_total_paise -> total_paise,
-- status saved -> posted, plus device_id (the device that saved the bill; on this release the shop
-- profile's device id). Every existing bill is copied, never dropped. bill_line references bill, so
-- the rebuild needs foreign keys off; migrateConnection switches them off before migrations start
-- (PRAGMA foreign_keys does nothing inside the migration transaction) and checks them afterwards.
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
	`payment_mode` text NOT NULL,
	`subtotal_paise` integer NOT NULL,
	`bill_discount_paise` integer NOT NULL,
	`total_paise` integer NOT NULL,
	`status` text NOT NULL,
	`cancel_reason` text,
	`cancelled_at` text,
	CONSTRAINT "bill_no_len" CHECK(length("__new_bill"."bill_no") <= 16),
	CONSTRAINT "bill_payment_mode" CHECK("__new_bill"."payment_mode" in ('cash','upi','card','unpaid')),
	CONSTRAINT "bill_status" CHECK("__new_bill"."status" in ('posted','cancelled')),
	CONSTRAINT "bill_cancel_reason_required" CHECK("__new_bill"."status" <> 'cancelled' or ("__new_bill"."cancel_reason" is not null and length(trim("__new_bill"."cancel_reason")) > 0)),
	CONSTRAINT "bill_discount_range" CHECK("__new_bill"."bill_discount_paise" >= 0 and "__new_bill"."bill_discount_paise" <= "__new_bill"."subtotal_paise"),
	CONSTRAINT "bill_total_eq" CHECK("__new_bill"."total_paise" = "__new_bill"."subtotal_paise" - "__new_bill"."bill_discount_paise")
);
--> statement-breakpoint
INSERT INTO `__new_bill`("id", "business_id", "shop_id", "created_at", "updated_at", "device_id", "counter_code", "bill_no", "financial_year", "seq", "bill_date", "customer_name", "client_bill_id", "payment_mode", "subtotal_paise", "bill_discount_paise", "total_paise", "status", "cancel_reason", "cancelled_at")
SELECT b.`id`, b.`business_id`, b.`shop_id`, b.`created_at`, b.`updated_at`,
  (SELECT p.`device_id` FROM `shop_profile` p WHERE p.`shop_id` = b.`shop_id` LIMIT 1),
  b.`series_code`, b.`number`, b.`financial_year`, b.`seq`, b.`bill_date`, b.`customer_name`, b.`client_bill_id`, b.`payment_mode`,
  b.`lines_total_paise`, b.`bill_discount_paise`, b.`grand_total_paise`,
  CASE b.`status` WHEN 'saved' THEN 'posted' ELSE b.`status` END,
  b.`cancel_reason`, b.`cancelled_at`
FROM `bill` b;--> statement-breakpoint
DROP TABLE `bill`;--> statement-breakpoint
ALTER TABLE `__new_bill` RENAME TO `bill`;--> statement-breakpoint
CREATE UNIQUE INDEX `bill_no_uq` ON `bill` (`shop_id`,`bill_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_counter_fy_seq_uq` ON `bill` (`counter_code`,`financial_year`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_client_bill_id_uq` ON `bill` (`shop_id`,`client_bill_id`);--> statement-breakpoint
CREATE INDEX `bill_date_idx` ON `bill` (`bill_date`);--> statement-breakpoint
CREATE INDEX `bill_customer_idx` ON `bill` (`customer_name`);--> statement-breakpoint
-- Rebuilding `bill` dropped its immutability triggers; recreate them with the new column names
-- (constitution I, II). A posted bill can only move to cancelled, with every other column unchanged.
CREATE TRIGGER bill_no_delete BEFORE DELETE ON bill
BEGIN SELECT RAISE(ABORT, 'bills cannot be deleted'); END;--> statement-breakpoint
CREATE TRIGGER bill_only_cancel_update BEFORE UPDATE ON bill
WHEN NOT (
  OLD.status = 'posted' AND NEW.status = 'cancelled'
  AND NEW.id = OLD.id AND NEW.device_id = OLD.device_id AND NEW.counter_code = OLD.counter_code
  AND NEW.bill_no = OLD.bill_no AND NEW.financial_year = OLD.financial_year AND NEW.seq = OLD.seq
  AND NEW.bill_date = OLD.bill_date AND NEW.customer_name IS OLD.customer_name
  AND NEW.client_bill_id IS OLD.client_bill_id AND NEW.payment_mode = OLD.payment_mode
  AND NEW.subtotal_paise = OLD.subtotal_paise AND NEW.bill_discount_paise = OLD.bill_discount_paise
  AND NEW.total_paise = OLD.total_paise
)
BEGIN SELECT RAISE(ABORT, 'a saved bill can only be cancelled, not edited'); END;
