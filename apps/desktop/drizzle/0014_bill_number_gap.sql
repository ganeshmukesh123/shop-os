-- T083: bill_number_gap records the numbers of a series that were printed but lost in a restore
-- (research D21). A new table only, so no existing row is touched. is_estimated says whether the owner
-- confirmed the last bill number (0) or could not say, so the block of 100 was assumed (1).
CREATE TABLE `bill_number_gap` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`number_series_id` text NOT NULL,
	`seq_from` integer NOT NULL,
	`seq_to` integer NOT NULL,
	`reason` text NOT NULL,
	`is_estimated` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`number_series_id`) REFERENCES `number_series`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_number_gap_range" CHECK("bill_number_gap"."seq_from" >= 1 and "bill_number_gap"."seq_to" >= "bill_number_gap"."seq_from"),
	CONSTRAINT "bill_number_gap_reason" CHECK("bill_number_gap"."reason" in ('lost_in_restore')),
	CONSTRAINT "bill_number_gap_estimated_bool" CHECK("bill_number_gap"."is_estimated" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `bill_number_gap_series_idx` ON `bill_number_gap` (`number_series_id`,`seq_from`);--> statement-breakpoint
-- A recorded gap is a fact about the numbers that were printed and lost; it is never edited or removed
-- (constitution I, II). Same wording as the other append-only tables.
CREATE TRIGGER bill_number_gap_no_update BEFORE UPDATE ON bill_number_gap
BEGIN SELECT RAISE(ABORT, 'bill_number_gap is append-only'); END;--> statement-breakpoint
CREATE TRIGGER bill_number_gap_no_delete BEFORE DELETE ON bill_number_gap
BEGIN SELECT RAISE(ABORT, 'bill_number_gap is append-only'); END;