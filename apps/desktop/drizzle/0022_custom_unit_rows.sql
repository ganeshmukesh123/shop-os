-- Hand-written (spec 002 data-model.md "uom"): every custom unit a 001 item uses (any text up to
-- 20 characters, such as "bag") gets a uom row with dimension count and no UQC, so a family and
-- a category default can use it. It allows decimals if any item in that unit does. Units that are
-- already rows (the nine seeded ones) are skipped. Only rows are added: no table is rebuilt, so
-- no trigger is dropped.
INSERT INTO `uom` (`id`, `business_id`, `shop_id`, `created_at`, `updated_at`, `code`, `label`, `dimension`, `uqc`, `allow_decimal`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `used`.`business_id`, `used`.`shop_id`,
  CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
  `used`.`base_uom`, `used`.`base_uom`, 'count', NULL, `used`.`allow_decimal`
FROM (
  SELECT `business_id`, min(`shop_id`) AS `shop_id`, `base_uom`, max(`allow_decimal`) AS `allow_decimal`
  FROM `item_variant`
  GROUP BY `business_id`, `base_uom`
) AS `used`
WHERE NOT EXISTS (
  SELECT 1 FROM `uom` WHERE `uom`.`business_id` = `used`.`business_id` AND `uom`.`code` = `used`.`base_uom`
);
