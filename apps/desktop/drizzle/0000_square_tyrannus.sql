CREATE TABLE `backup_log` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`path` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`error` text,
	CONSTRAINT "backup_log_status" CHECK("backup_log"."status" in ('ok','failed'))
);
--> statement-breakpoint
CREATE TABLE `bill` (
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
	`customer_phone` text,
	`payment_mode` text NOT NULL,
	`lines_total_paise` integer NOT NULL,
	`bill_discount_paise` integer NOT NULL,
	`grand_total_paise` integer NOT NULL,
	`status` text NOT NULL,
	`cancel_reason` text,
	`cancelled_at` text,
	CONSTRAINT "bill_payment_mode" CHECK("bill"."payment_mode" in ('cash','upi','card','unpaid')),
	CONSTRAINT "bill_status" CHECK("bill"."status" in ('saved','cancelled')),
	CONSTRAINT "bill_cancel_reason_required" CHECK("bill"."status" <> 'cancelled' or ("bill"."cancel_reason" is not null and length(trim("bill"."cancel_reason")) > 0)),
	CONSTRAINT "bill_discount_range" CHECK("bill"."bill_discount_paise" >= 0 and "bill"."bill_discount_paise" <= "bill"."lines_total_paise"),
	CONSTRAINT "bill_total_eq" CHECK("bill"."grand_total_paise" = "bill"."lines_total_paise" - "bill"."bill_discount_paise"),
	CONSTRAINT "bill_phone_digits" CHECK("bill"."customer_phone" is null or (length("bill"."customer_phone") between 10 and 15 and "bill"."customer_phone" not glob '*[^0-9]*'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bill_number_uq` ON `bill` (`shop_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_series_fy_seq_uq` ON `bill` (`series_code`,`financial_year`,`seq`);--> statement-breakpoint
CREATE INDEX `bill_date_idx` ON `bill` (`bill_date`);--> statement-breakpoint
CREATE INDEX `bill_customer_idx` ON `bill` (`customer_name`);--> statement-breakpoint
CREATE TABLE `bill_line` (
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
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_line_qty_pos" CHECK("bill_line"."quantity_milli" > 0),
	CONSTRAINT "bill_line_rate_nonneg" CHECK("bill_line"."rate_paise" >= 0),
	CONSTRAINT "bill_line_discount_nonneg" CHECK("bill_line"."line_discount_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX `bill_line_bill_idx` ON `bill_line` (`bill_id`);--> statement-breakpoint
CREATE TABLE `draft_bill` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`allows_decimal` integer DEFAULT 0 NOT NULL,
	`price_paise` integer NOT NULL,
	`stock_milli` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`hsn` text,
	`gst_rate_bp` integer,
	`barcode` text,
	CONSTRAINT "item_name_len" CHECK(length("item"."name") between 1 and 120 and "item"."name" = trim("item"."name")),
	CONSTRAINT "item_unit_len" CHECK(length("item"."unit") between 1 and 20),
	CONSTRAINT "item_price_nonneg" CHECK("item"."price_paise" >= 0),
	CONSTRAINT "item_allows_decimal_bool" CHECK("item"."allows_decimal" in (0, 1)),
	CONSTRAINT "item_active_bool" CHECK("item"."active" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `item_name_nocase_idx` ON `item` ("name" COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `number_counter` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`series_code` text NOT NULL,
	`financial_year` text NOT NULL,
	`last_seq` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `number_counter_uq` ON `number_counter` (`series_code`,`financial_year`);--> statement-breakpoint
CREATE TABLE `shop_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`series_code` text DEFAULT 'C1' NOT NULL,
	`number_template` text DEFAULT '{series}/{fy}/{seq}' NOT NULL,
	`footer` text DEFAULT '' NOT NULL,
	`receipt_width` text DEFAULT '80mm' NOT NULL,
	`backup_folder` text DEFAULT '' NOT NULL,
	`device_id` text NOT NULL,
	CONSTRAINT "shop_profile_name_len" CHECK(length("shop_profile"."name") between 1 and 80),
	CONSTRAINT "shop_profile_address_len" CHECK(length("shop_profile"."address") <= 200),
	CONSTRAINT "shop_profile_phone_len" CHECK(length("shop_profile"."phone") <= 20),
	CONSTRAINT "shop_profile_footer_len" CHECK(length("shop_profile"."footer") <= 200),
	CONSTRAINT "shop_profile_width" CHECK("shop_profile"."receipt_width" in ('58mm','80mm'))
);
--> statement-breakpoint
CREATE TABLE `stock_movement` (
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
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bill_id`) REFERENCES `bill`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_movement_nonzero" CHECK("stock_movement"."quantity_milli" <> 0),
	CONSTRAINT "stock_movement_reason" CHECK("stock_movement"."reason" in ('opening','adjustment','sale','sale_cancel')),
	CONSTRAINT "stock_movement_note_len" CHECK("stock_movement"."note" is null or length("stock_movement"."note") <= 200)
);
--> statement-breakpoint
CREATE INDEX `stock_movement_item_idx` ON `stock_movement` (`item_id`,`occurred_at`);