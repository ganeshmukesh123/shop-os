CREATE TABLE `bill_line_tint` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`bill_line_id` text NOT NULL,
	`colorant_variant_id` text NOT NULL,
	`colorant_name_snapshot` text NOT NULL,
	`qty_milli` integer NOT NULL,
	`cost_paise` integer NOT NULL,
	FOREIGN KEY (`bill_line_id`) REFERENCES `bill_line`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`colorant_variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_line_tint_qty_pos" CHECK("bill_line_tint"."qty_milli" > 0),
	CONSTRAINT "bill_line_tint_cost_nonneg" CHECK("bill_line_tint"."cost_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bill_line_tint_colorant_uq` ON `bill_line_tint` (`bill_line_id`,`colorant_variant_id`);--> statement-breakpoint
CREATE TABLE `tint_charge_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`declared_qty_milli` integer NOT NULL,
	`declared_uom` text NOT NULL,
	`charge_paise` integer NOT NULL,
	CONSTRAINT "tint_charge_rule_qty_pos" CHECK("tint_charge_rule"."declared_qty_milli" > 0),
	CONSTRAINT "tint_charge_rule_charge_nonneg" CHECK("tint_charge_rule"."charge_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tint_charge_rule_pack_uq` ON `tint_charge_rule` (`business_id`,`declared_uom`,`declared_qty_milli`);--> statement-breakpoint
CREATE TABLE `tint_formula` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`shade_id` text NOT NULL,
	`base_variant_id` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`shade_id`) REFERENCES `tint_shade`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`base_variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tint_formula_version_pos" CHECK("tint_formula"."version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tint_formula_version_uq` ON `tint_formula` (`shade_id`,`base_variant_id`,`version`);--> statement-breakpoint
CREATE TABLE `tint_formula_line` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`formula_id` text NOT NULL,
	`colorant_variant_id` text NOT NULL,
	`qty_milli` integer NOT NULL,
	FOREIGN KEY (`formula_id`) REFERENCES `tint_formula`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`colorant_variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tint_formula_line_qty_pos" CHECK("tint_formula_line"."qty_milli" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tint_formula_line_colorant_uq` ON `tint_formula_line` (`formula_id`,`colorant_variant_id`);--> statement-breakpoint
CREATE TABLE `tint_shade` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`shade_code` text NOT NULL,
	`shade_name` text NOT NULL,
	`brand_id` text,
	`shade_card` text,
	`source` text NOT NULL,
	`customer_label` text,
	`site_label` text,
	`party_id` text,
	FOREIGN KEY (`brand_id`) REFERENCES `brand`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tint_shade_code_len" CHECK(length("tint_shade"."shade_code") between 1 and 20),
	CONSTRAINT "tint_shade_name_len" CHECK(length("tint_shade"."shade_name") between 1 and 60),
	CONSTRAINT "tint_shade_card_len" CHECK("tint_shade"."shade_card" is null or length("tint_shade"."shade_card") <= 60),
	CONSTRAINT "tint_shade_source_enum" CHECK("tint_shade"."source" in ('library', 'custom')),
	CONSTRAINT "tint_shade_labels_len" CHECK(("tint_shade"."customer_label" is null or length("tint_shade"."customer_label") <= 80) and ("tint_shade"."site_label" is null or length("tint_shade"."site_label") <= 80)),
	CONSTRAINT "tint_shade_custom_labelled" CHECK("tint_shade"."source" = 'library' or coalesce(trim("tint_shade"."customer_label", char(9, 10, 11, 12, 13, 32)), '') <> '' or coalesce(trim("tint_shade"."site_label", char(9, 10, 11, 12, 13, 32)), '') <> '')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tint_shade_library_code_uq` ON `tint_shade` (`brand_id`,`shade_code`) WHERE "tint_shade"."source" = 'library';--> statement-breakpoint
CREATE TABLE `tint_shade_price` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`shade_id` text NOT NULL,
	`base_variant_id` text NOT NULL,
	`price_paise` integer NOT NULL,
	FOREIGN KEY (`shade_id`) REFERENCES `tint_shade`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`base_variant_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tint_shade_price_pos" CHECK("tint_shade_price"."price_paise" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tint_shade_price_uq` ON `tint_shade_price` (`shade_id`,`base_variant_id`);--> statement-breakpoint
ALTER TABLE `bill_line` ADD `entered_uom` text;--> statement-breakpoint
ALTER TABLE `bill_line` ADD `qty_entered_milli` integer;--> statement-breakpoint
ALTER TABLE `bill_line` ADD `tint_formula_id` text REFERENCES tint_formula(id);--> statement-breakpoint
ALTER TABLE `bill_line` ADD `tint_charge_paise` integer;--> statement-breakpoint
ALTER TABLE `bill_line` ADD `cost_paise` integer;--> statement-breakpoint
ALTER TABLE `bill_line` ADD `is_returnable` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `bill_line_tint_formula_idx` ON `bill_line` (`tint_formula_id`);--> statement-breakpoint
-- Hand-written (spec 002 T020): the new bill_line columns were added with ADD COLUMN so the
-- table holding every saved line is not rebuilt. bill_line is insert-only, so an insert trigger
-- enforces their rules where a CHECK would have. Each test is fully decided (no NULL comparison).
CREATE TRIGGER bill_line_new_values BEFORE INSERT ON bill_line
WHEN (NEW.tint_charge_paise IS NOT NULL AND NEW.tint_charge_paise < 0)
  OR (NEW.cost_paise IS NOT NULL AND NEW.cost_paise < 0)
  OR NEW.is_returnable NOT IN (0, 1)
  OR ((NEW.entered_uom IS NULL) <> (NEW.qty_entered_milli IS NULL))
  OR (NEW.qty_entered_milli IS NOT NULL AND NEW.qty_entered_milli <= 0)
BEGIN SELECT RAISE(ABORT, 'bill_line: a tint charge or cost below zero, a returnable flag other than 0 or 1, or an entered unit without its quantity'); END;--> statement-breakpoint
-- bill_line_tint is a snapshot written with the bill; it never changes.
CREATE TRIGGER bill_line_tint_no_update BEFORE UPDATE ON bill_line_tint
BEGIN SELECT RAISE(ABORT, 'bill_line_tint is append-only'); END;--> statement-breakpoint
CREATE TRIGGER bill_line_tint_no_delete BEFORE DELETE ON bill_line_tint
BEGIN SELECT RAISE(ABORT, 'bill_line_tint is append-only'); END;--> statement-breakpoint
-- A formula a bill used is frozen (constitution I); a change saves a new version. These read
-- bill_line.tint_formula_id through its index. A new, unused version takes lines freely.
CREATE TRIGGER tint_formula_frozen_update BEFORE UPDATE ON tint_formula
WHEN EXISTS (SELECT 1 FROM bill_line WHERE tint_formula_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'tint_formula: this formula is used on a bill; save a new version'); END;--> statement-breakpoint
CREATE TRIGGER tint_formula_frozen_delete BEFORE DELETE ON tint_formula
WHEN EXISTS (SELECT 1 FROM bill_line WHERE tint_formula_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'tint_formula: this formula is used on a bill; save a new version'); END;--> statement-breakpoint
CREATE TRIGGER tint_formula_line_frozen_insert BEFORE INSERT ON tint_formula_line
WHEN EXISTS (SELECT 1 FROM bill_line WHERE tint_formula_id = NEW.formula_id)
BEGIN SELECT RAISE(ABORT, 'tint_formula_line: this formula is used on a bill; save a new version'); END;--> statement-breakpoint
CREATE TRIGGER tint_formula_line_frozen_update BEFORE UPDATE ON tint_formula_line
WHEN EXISTS (SELECT 1 FROM bill_line WHERE tint_formula_id IN (OLD.formula_id, NEW.formula_id))
BEGIN SELECT RAISE(ABORT, 'tint_formula_line: this formula is used on a bill; save a new version'); END;--> statement-breakpoint
CREATE TRIGGER tint_formula_line_frozen_delete BEFORE DELETE ON tint_formula_line
WHEN EXISTS (SELECT 1 FROM bill_line WHERE tint_formula_id = OLD.formula_id)
BEGIN SELECT RAISE(ABORT, 'tint_formula_line: this formula is used on a bill; save a new version'); END;