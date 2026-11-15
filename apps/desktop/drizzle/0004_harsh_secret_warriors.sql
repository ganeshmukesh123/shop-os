PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bill` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`number` text NOT NULL,
	`series_code` text NOT NULL,
	`financial_year` text NOT NULL,
	`seq` integer NOT NULL,
	`bill_date` text NOT NULL,
	`customer_name` text,
	`client_bill_id` text,
	`payment_mode` text NOT NULL,
	`lines_total_paise` integer NOT NULL,
	`bill_discount_paise` integer NOT NULL,
	`grand_total_paise` integer NOT NULL,
	`status` text NOT NULL,
	`cancel_reason` text,
	`cancelled_at` text,
	CONSTRAINT "bill_number_len" CHECK(length("__new_bill"."number") <= 16),
	CONSTRAINT "bill_payment_mode" CHECK("__new_bill"."payment_mode" in ('cash','upi','card','unpaid')),
	CONSTRAINT "bill_status" CHECK("__new_bill"."status" in ('saved','cancelled')),
	CONSTRAINT "bill_cancel_reason_required" CHECK("__new_bill"."status" <> 'cancelled' or ("__new_bill"."cancel_reason" is not null and length(trim("__new_bill"."cancel_reason")) > 0)),
	CONSTRAINT "bill_discount_range" CHECK("__new_bill"."bill_discount_paise" >= 0 and "__new_bill"."bill_discount_paise" <= "__new_bill"."lines_total_paise"),
	CONSTRAINT "bill_total_eq" CHECK("__new_bill"."grand_total_paise" = "__new_bill"."lines_total_paise" - "__new_bill"."bill_discount_paise")
);
--> statement-breakpoint
INSERT INTO `__new_bill`("id", "business_id", "shop_id", "created_at", "updated_at", "number", "series_code", "financial_year", "seq", "bill_date", "customer_name", "client_bill_id", "payment_mode", "lines_total_paise", "bill_discount_paise", "grand_total_paise", "status", "cancel_reason", "cancelled_at") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "number", "series_code", "financial_year", "seq", "bill_date", "customer_name", "client_bill_id", "payment_mode", "lines_total_paise", "bill_discount_paise", "grand_total_paise", "status", "cancel_reason", "cancelled_at" FROM `bill`;--> statement-breakpoint
DROP TABLE `bill`;--> statement-breakpoint
ALTER TABLE `__new_bill` RENAME TO `bill`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `bill_number_uq` ON `bill` (`shop_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_series_fy_seq_uq` ON `bill` (`series_code`,`financial_year`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_client_bill_id_uq` ON `bill` (`shop_id`,`client_bill_id`);--> statement-breakpoint
CREATE INDEX `bill_date_idx` ON `bill` (`bill_date`);--> statement-breakpoint
CREATE INDEX `bill_customer_idx` ON `bill` (`customer_name`);--> statement-breakpoint
-- Rebuilding `bill` dropped its immutability triggers; recreate them (constitution I, II).
CREATE TRIGGER bill_no_delete BEFORE DELETE ON bill
BEGIN SELECT RAISE(ABORT, 'bills cannot be deleted'); END;--> statement-breakpoint
CREATE TRIGGER bill_only_cancel_update BEFORE UPDATE ON bill
WHEN NOT (
  OLD.status = 'saved' AND NEW.status = 'cancelled'
  AND NEW.id = OLD.id AND NEW.number = OLD.number AND NEW.series_code = OLD.series_code
  AND NEW.financial_year = OLD.financial_year AND NEW.seq = OLD.seq AND NEW.bill_date = OLD.bill_date
  AND NEW.customer_name IS OLD.customer_name AND NEW.client_bill_id IS OLD.client_bill_id
  AND NEW.payment_mode = OLD.payment_mode AND NEW.lines_total_paise = OLD.lines_total_paise
  AND NEW.bill_discount_paise = OLD.bill_discount_paise AND NEW.grand_total_paise = OLD.grand_total_paise
)
BEGIN SELECT RAISE(ABORT, 'a saved bill can only be cancelled, not edited'); END;