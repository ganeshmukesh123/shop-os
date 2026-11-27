CREATE TABLE `attribute_def` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`data_type` text NOT NULL,
	`unit_kind` text,
	CONSTRAINT "attribute_def_data_type_enum" CHECK("attribute_def"."data_type" in ('enum', 'text', 'measure'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attribute_def_business_key_uq` ON `attribute_def` (`business_id`,`key`);--> statement-breakpoint
CREATE TABLE `brand` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT "brand_name_len" CHECK(length("brand"."name") between 1 and 60 and "brand"."name" = trim("brand"."name"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brand_business_name_nocase_uq` ON `brand` (`business_id`,"name" COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`default_hsn` text,
	`default_base_uom` text,
	`title_template` text,
	FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`,`default_base_uom`) REFERENCES `uom`(`business_id`,`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "category_name_len" CHECK(length("category"."name") between 1 and 80 and "category"."name" = trim("category"."name")),
	CONSTRAINT "category_default_hsn_digits" CHECK("category"."default_hsn" is null or (length("category"."default_hsn") in (4, 6, 8) and "category"."default_hsn" not glob '*[^0-9]*'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_sibling_name_nocase_uq` ON `category` (`business_id`,coalesce("parent_id", ''),"name" COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `uom` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`dimension` text NOT NULL,
	`uqc` text,
	`allow_decimal` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "uom_code_len" CHECK(length("uom"."code") between 1 and 20),
	CONSTRAINT "uom_dimension_enum" CHECK("uom"."dimension" in ('count', 'length', 'mass', 'volume')),
	CONSTRAINT "uom_allow_decimal_bool" CHECK("uom"."allow_decimal" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uom_business_code_uq` ON `uom` (`business_id`,`code`);--> statement-breakpoint
-- Hand-written (spec 002 T016): seed the catalogue's system rows for a shop that already exists.
-- A new database has no shop yet, so these select nothing and seed.ts inserts the same rows
-- (catalogueSeed.ts). Ids are random UUID text; times are epoch milliseconds now.
INSERT INTO `attribute_def` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `key`, `label`, `data_type`, `unit_kind`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `shop_profile`.`business_id`, `shop_profile`.`shop_id`,
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  `seeded`.`column1`, `seeded`.`column2`, `seeded`.`column3`, NULL
FROM `shop_profile` CROSS JOIN (VALUES
  ('size', 'Size', 'text'), ('gauge', 'Gauge', 'text'), ('shade', 'Shade', 'text'),
  ('pack_size', 'Pack size', 'text'), ('colour', 'Colour', 'text'), ('length', 'Length', 'text'),
  ('rating', 'Rating', 'text'), ('brand', 'Brand', 'text'), ('class', 'Class', 'enum'),
  ('base_type', 'Base type', 'enum')
) AS `seeded`;--> statement-breakpoint
INSERT INTO `uom` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `code`, `label`, `dimension`, `uqc`, `allow_decimal`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `shop_profile`.`business_id`, `shop_profile`.`shop_id`,
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  `seeded`.`column1`, `seeded`.`column2`, `seeded`.`column3`, `seeded`.`column4`, `seeded`.`column5`
FROM `shop_profile` CROSS JOIN (VALUES
  ('pcs', 'Pieces', 'count', 'NOS', 0), ('metre', 'Metre', 'length', 'MTR', 1),
  ('kg', 'Kilogram', 'mass', 'KGS', 1), ('litre', 'Litre', 'volume', 'LTR', 1),
  ('ml', 'Millilitre', 'volume', 'MLT', 1), ('box', 'Box', 'count', 'BOX', 0),
  ('roll', 'Roll', 'count', 'ROL', 0), ('pair', 'Pair', 'count', 'PRS', 0),
  ('bundle', 'Bundle', 'count', 'BDL', 0)
) AS `seeded`;