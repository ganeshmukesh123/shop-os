PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_item_family` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'general' NOT NULL,
	`category_id` text,
	`brand_id` text,
	`spec` text DEFAULT '{}' NOT NULL,
	`axis_keys` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`brand_id`) REFERENCES `brand`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_family_name_len" CHECK(length("__new_item_family"."name") between 1 and 120 and "__new_item_family"."name" = trim("__new_item_family"."name")),
	CONSTRAINT "item_family_kind_enum" CHECK("__new_item_family"."kind" in ('general', 'base_paint', 'colorant', 'paint', 'thinner_solvent')),
	CONSTRAINT "item_family_spec_object" CHECK(json_valid("__new_item_family"."spec") and json_type("__new_item_family"."spec") = 'object'),
	CONSTRAINT "item_family_axis_keys_array" CHECK(json_valid("__new_item_family"."axis_keys") and json_type("__new_item_family"."axis_keys") = 'array' and json_array_length("__new_item_family"."axis_keys") <= 4)
);
--> statement-breakpoint
-- Hand-edited (spec 002 T017): copy only the 001 columns. drizzle-kit also selected the new
-- columns from the old table, where SQLite reads a missing name as a text literal ('kind').
-- The new columns take their defaults: kind 'general', spec '{}', axis_keys '[]'.
INSERT INTO `__new_item_family`("id", "business_id", "shop_id", "created_at", "updated_at", "name") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "name" FROM `item_family`;--> statement-breakpoint
DROP TABLE `item_family`;--> statement-breakpoint
ALTER TABLE `__new_item_family` RENAME TO `item_family`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
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
	`axes` text DEFAULT '{}' NOT NULL,
	`axis_signature` text DEFAULT '' NOT NULL,
	`purchase_price_paise` integer,
	`reorder_level_milli` integer,
	`location_tag` text,
	`petroleum_class` text,
	`declared_qty_milli` integer,
	`declared_uom` text,
	`trade_label` text,
	`sealed_pack_only` integer DEFAULT 0 NOT NULL,
	`warranty_months` integer,
	`is_serial_tracked` integer DEFAULT 0 NOT NULL,
	`merged_into_id` text,
	FOREIGN KEY (`family_id`) REFERENCES `item_family`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merged_into_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_variant_name_len" CHECK(length("__new_item_variant"."display_name") between 1 and 120 and "__new_item_variant"."display_name" = trim("__new_item_variant"."display_name")),
	CONSTRAINT "item_variant_uom_len" CHECK(length("__new_item_variant"."base_uom") between 1 and 20),
	CONSTRAINT "item_variant_price_nonneg" CHECK("__new_item_variant"."selling_price_paise" >= 0),
	CONSTRAINT "item_variant_allow_decimal_bool" CHECK("__new_item_variant"."allow_decimal" in (0, 1)),
	CONSTRAINT "item_variant_active_bool" CHECK("__new_item_variant"."is_active" in (0, 1)),
	CONSTRAINT "item_variant_axes_object" CHECK(json_valid("__new_item_variant"."axes") and json_type("__new_item_variant"."axes") = 'object'),
	CONSTRAINT "item_variant_purchase_price_nonneg" CHECK("__new_item_variant"."purchase_price_paise" is null or "__new_item_variant"."purchase_price_paise" >= 0),
	CONSTRAINT "item_variant_reorder_level_nonneg" CHECK("__new_item_variant"."reorder_level_milli" is null or "__new_item_variant"."reorder_level_milli" >= 0),
	CONSTRAINT "item_variant_location_tag_len" CHECK("__new_item_variant"."location_tag" is null or length("__new_item_variant"."location_tag") <= 30),
	CONSTRAINT "item_variant_petroleum_class_enum" CHECK("__new_item_variant"."petroleum_class" is null or "__new_item_variant"."petroleum_class" in ('A', 'B', 'C', 'NA')),
	CONSTRAINT "item_variant_declared_pair" CHECK(("__new_item_variant"."declared_qty_milli" is null and "__new_item_variant"."declared_uom" is null) or ("__new_item_variant"."declared_qty_milli" is not null and "__new_item_variant"."declared_qty_milli" > 0 and "__new_item_variant"."declared_uom" is not null)),
	CONSTRAINT "item_variant_trade_label_len" CHECK("__new_item_variant"."trade_label" is null or length("__new_item_variant"."trade_label") <= 20),
	CONSTRAINT "item_variant_sealed_pack_whole" CHECK("__new_item_variant"."sealed_pack_only" in (0, 1) and ("__new_item_variant"."sealed_pack_only" = 0 or "__new_item_variant"."allow_decimal" = 0)),
	CONSTRAINT "item_variant_warranty_range" CHECK("__new_item_variant"."warranty_months" is null or "__new_item_variant"."warranty_months" between 0 and 120),
	CONSTRAINT "item_variant_serial_bool" CHECK("__new_item_variant"."is_serial_tracked" in (0, 1)),
	CONSTRAINT "item_variant_not_merged_into_self" CHECK("__new_item_variant"."merged_into_id" is null or "__new_item_variant"."merged_into_id" <> "__new_item_variant"."id")
);
--> statement-breakpoint
-- Hand-edited (spec 002 T017): copy only the 001 columns, for the same reason; the new columns
-- take their defaults (axes '{}', axis_signature '', flags 0, everything else NULL).
INSERT INTO `__new_item_variant`("id", "business_id", "shop_id", "created_at", "updated_at", "family_id", "item_code", "display_name", "base_uom", "allow_decimal", "selling_price_paise", "stock_milli", "is_active", "hsn_code", "gst_rate_override_bp", "barcode") SELECT "id", "business_id", "shop_id", "created_at", "updated_at", "family_id", "item_code", "display_name", "base_uom", "allow_decimal", "selling_price_paise", "stock_milli", "is_active", "hsn_code", "gst_rate_override_bp", "barcode" FROM `item_variant`;--> statement-breakpoint
DROP TABLE `item_variant`;--> statement-breakpoint
ALTER TABLE `__new_item_variant` RENAME TO `item_variant`;--> statement-breakpoint
CREATE UNIQUE INDEX `item_variant_code_uq` ON `item_variant` (`business_id`,`item_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_variant_family_signature_uq` ON `item_variant` (`family_id`,`axis_signature`);--> statement-breakpoint
CREATE INDEX `item_variant_name_nocase_idx` ON `item_variant` ("display_name" COLLATE NOCASE);