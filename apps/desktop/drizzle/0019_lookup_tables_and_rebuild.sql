CREATE TABLE `exception_kind` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`code` text NOT NULL,
	CONSTRAINT "exception_kind_code_len" CHECK(length("exception_kind"."code") between 1 and 40)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exception_kind_business_code_uq` ON `exception_kind` (`business_id`,`code`);--> statement-breakpoint
CREATE TABLE `movement_doc_type` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`code` text NOT NULL,
	CONSTRAINT "movement_doc_type_code_len" CHECK(length("movement_doc_type"."code") between 1 and 40)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movement_doc_type_business_code_uq` ON `movement_doc_type` (`business_id`,`code`);--> statement-breakpoint
CREATE TABLE `movement_type` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`code` text NOT NULL,
	`direction` text NOT NULL,
	`requires_doc` integer DEFAULT 0 NOT NULL,
	`required_doc_type` text,
	`requires_reason` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`business_id`,`required_doc_type`) REFERENCES `movement_doc_type`(`business_id`,`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "movement_type_code_len" CHECK(length("movement_type"."code") between 1 and 40),
	CONSTRAINT "movement_type_direction_enum" CHECK("movement_type"."direction" in ('in', 'out', 'either', 'both')),
	CONSTRAINT "movement_type_doc_rule" CHECK(("movement_type"."requires_doc" = 0 and "movement_type"."required_doc_type" is null) or ("movement_type"."requires_doc" = 1 and "movement_type"."required_doc_type" is not null)),
	CONSTRAINT "movement_type_reason_bool" CHECK("movement_type"."requires_reason" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movement_type_business_code_uq` ON `movement_type` (`business_id`,`code`);--> statement-breakpoint
CREATE TABLE `tender_mode` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`code` text NOT NULL,
	CONSTRAINT "tender_mode_code_len" CHECK(length("tender_mode"."code") between 1 and 40)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tender_mode_business_code_uq` ON `tender_mode` (`business_id`,`code`);--> statement-breakpoint
CREATE TABLE `tender_status` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`code` text NOT NULL,
	CONSTRAINT "tender_status_code_len" CHECK(length("tender_status"."code") between 1 and 40)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tender_status_business_code_uq` ON `tender_status` (`business_id`,`code`);--> statement-breakpoint
-- Hand-written (spec 002 T019): seed the lookup rows for a shop that already exists, before
-- the rebuilt tables copy rows that point at them. A new database has no shop yet, so these
-- select nothing and seed.ts inserts the same rows (catalogueSeed.ts).
INSERT INTO `movement_doc_type` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `code`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `shop_profile`.`business_id`, `shop_profile`.`shop_id`, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), `seeded`.`column1`
FROM `shop_profile` CROSS JOIN (VALUES ('bill'), ('item_merge')) AS `seeded`;--> statement-breakpoint
INSERT INTO `movement_type` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `code`, `direction`, `requires_doc`, `required_doc_type`, `requires_reason`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `shop_profile`.`business_id`, `shop_profile`.`shop_id`, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  `seeded`.`column1`, `seeded`.`column2`, `seeded`.`column3`, `seeded`.`column4`, `seeded`.`column5`
FROM `shop_profile` CROSS JOIN (VALUES
  ('opening', 'in', 0, NULL, 0), ('adjustment', 'either', 0, NULL, 1),
  ('sale', 'out', 1, 'bill', 0), ('sale_cancel', 'in', 1, 'bill', 0),
  ('merge_in', 'in', 1, 'item_merge', 0), ('merge_out', 'out', 1, 'item_merge', 0)
) AS `seeded`;--> statement-breakpoint
INSERT INTO `tender_mode` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `code`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `shop_profile`.`business_id`, `shop_profile`.`shop_id`, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), `seeded`.`column1`
FROM `shop_profile` CROSS JOIN (VALUES ('cash'), ('upi'), ('card'), ('unpaid')) AS `seeded`;--> statement-breakpoint
INSERT INTO `tender_status` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `code`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `shop_profile`.`business_id`, `shop_profile`.`shop_id`, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), `seeded`.`column1`
FROM `shop_profile` CROSS JOIN (VALUES ('label')) AS `seeded`;--> statement-breakpoint
INSERT INTO `exception_kind` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `code`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `shop_profile`.`business_id`, `shop_profile`.`shop_id`, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), `seeded`.`column1`
FROM `shop_profile` CROSS JOIN (VALUES ('duplicate_barcode'), ('duplicate_suspect')) AS `seeded`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	FOREIGN KEY (`business_id`,`mode`) REFERENCES `tender_mode`(`business_id`,`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`,`status`) REFERENCES `tender_status`(`business_id`,`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_tender_amount_nonneg" CHECK("__new_bill_tender"."amount_paise" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_bill_tender`("id", "business_id", "shop_id", "created_at", "updated_at", "bill_id", "mode", "amount_paise", "status") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "bill_id", "mode", "amount_paise", "status" FROM `bill_tender`;--> statement-breakpoint
DROP TABLE `bill_tender`;--> statement-breakpoint
ALTER TABLE `__new_bill_tender` RENAME TO `bill_tender`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bill_tender_bill_idx` ON `bill_tender` (`bill_id`);--> statement-breakpoint
-- Hand-written: DROP TABLE dropped bill_tender's append-only triggers; re-create them.
CREATE TRIGGER bill_tender_no_update BEFORE UPDATE ON bill_tender
BEGIN SELECT RAISE(ABORT, 'bill_tender is immutable'); END;--> statement-breakpoint
CREATE TRIGGER bill_tender_no_delete BEFORE DELETE ON bill_tender
BEGIN SELECT RAISE(ABORT, 'bill_tender is immutable'); END;--> statement-breakpoint
CREATE TABLE `__new_location` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	CONSTRAINT "location_name_len" CHECK(length("__new_location"."name") between 1 and 80),
	CONSTRAINT "location_kind" CHECK("__new_location"."kind" in ('shop_floor', 'godown', 'tinted_returns'))
);
--> statement-breakpoint
INSERT INTO `__new_location`("id", "business_id", "shop_id", "created_at", "updated_at", "name", "kind") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "name", "kind" FROM `location`;--> statement-breakpoint
DROP TABLE `location`;--> statement-breakpoint
ALTER TABLE `__new_location` RENAME TO `location`;--> statement-breakpoint
-- Hand-written (spec 002 T019): one "Tinted returns" location per existing shop. Stock is not
-- moved there until feature 003's return flow.
INSERT INTO `location` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `name`, `kind`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `business_id`, `shop_id`, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), 'Tinted returns', 'tinted_returns'
FROM `shop_profile`;--> statement-breakpoint
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
	`batch_id` text,
	FOREIGN KEY (`variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `item_batch`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`,`movement_type`) REFERENCES `movement_type`(`business_id`,`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`,`doc_type`) REFERENCES `movement_doc_type`(`business_id`,`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_movement_qty_pos" CHECK("__new_stock_movement"."qty_base_milli" > 0),
	CONSTRAINT "stock_movement_doc_pair" CHECK(("__new_stock_movement"."doc_type" is null) = ("__new_stock_movement"."doc_id" is null)),
	CONSTRAINT "stock_movement_note_len" CHECK("__new_stock_movement"."note" is null or length("__new_stock_movement"."note") <= 200)
);
--> statement-breakpoint
-- Hand-edited: copy every 001 column; batch_id is new and starts NULL. drizzle-kit selected
-- "batch_id" from the old table, where SQLite would read it as the text 'batch_id'.
INSERT INTO `__new_stock_movement`("id", "business_id", "shop_id", "created_at", "updated_at", "variant_id", "movement_type", "qty_base_milli", "from_location_id", "to_location_id", "doc_type", "doc_id", "reason_code", "note", "occurred_at", "device_id") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "variant_id", "movement_type", "qty_base_milli", "from_location_id", "to_location_id", "doc_type", "doc_id", "reason_code", "note", "occurred_at", "device_id" FROM `stock_movement`;--> statement-breakpoint
DROP TABLE `stock_movement`;--> statement-breakpoint
ALTER TABLE `__new_stock_movement` RENAME TO `stock_movement`;--> statement-breakpoint
CREATE INDEX `stock_movement_variant_idx` ON `stock_movement` (`variant_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `stock_movement_doc_idx` ON `stock_movement` (`doc_type`,`doc_id`);--> statement-breakpoint
-- Hand-written: DROP TABLE dropped stock_movement's append-only triggers; re-create them.
CREATE TRIGGER stock_movement_no_update BEFORE UPDATE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
CREATE TRIGGER stock_movement_no_delete BEFORE DELETE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
-- Hand-written (research D17): the rules that depend on the movement type, read from its
-- movement_type row, so a later type (a transfer, direction 'both') is one INSERT, not a rebuild.
-- Each test is fully decided (IS NULL, IS NOT, <> on non-null values), so a NULL never lets a
-- bad row through. The FK already refuses an unknown type.
CREATE TRIGGER stock_movement_rules BEFORE INSERT ON stock_movement
BEGIN
  SELECT RAISE(ABORT, 'stock_movement: the locations do not match the movement type')
  FROM movement_type WHERE movement_type.business_id = NEW.business_id AND movement_type.code = NEW.movement_type
    AND NOT (
      (movement_type.direction = 'in' AND NEW.to_location_id IS NOT NULL AND NEW.from_location_id IS NULL)
      OR (movement_type.direction = 'out' AND NEW.from_location_id IS NOT NULL AND NEW.to_location_id IS NULL)
      OR (movement_type.direction = 'either' AND (NEW.from_location_id IS NULL) <> (NEW.to_location_id IS NULL))
      OR (movement_type.direction = 'both' AND NEW.from_location_id IS NOT NULL AND NEW.to_location_id IS NOT NULL
          AND NEW.from_location_id <> NEW.to_location_id));
  SELECT RAISE(ABORT, 'stock_movement: this movement type needs its document')
  FROM movement_type WHERE movement_type.business_id = NEW.business_id AND movement_type.code = NEW.movement_type
    AND movement_type.requires_doc = 1
    AND (NEW.doc_id IS NULL OR NEW.doc_type IS NOT movement_type.required_doc_type);
  SELECT RAISE(ABORT, 'stock_movement: this movement type has no document')
  FROM movement_type WHERE movement_type.business_id = NEW.business_id AND movement_type.code = NEW.movement_type
    AND movement_type.requires_doc = 0 AND NEW.doc_id IS NOT NULL;
  SELECT RAISE(ABORT, 'stock_movement: this movement type needs a reason')
  FROM movement_type WHERE movement_type.business_id = NEW.business_id AND movement_type.code = NEW.movement_type
    AND movement_type.requires_reason = 1
    AND coalesce(length(trim(NEW.reason_code)), 0) = 0 AND coalesce(length(trim(NEW.note)), 0) = 0;
END;