CREATE TABLE `exception_event` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`kind` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_ids` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_at` integer,
	`resolution_note` text,
	FOREIGN KEY (`business_id`,`kind`) REFERENCES `exception_kind`(`business_id`,`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "exception_event_subject_type" CHECK("exception_event"."subject_type" in ('item_variant')),
	CONSTRAINT "exception_event_subject_ids_array" CHECK(json_valid("exception_event"."subject_ids") and json_type("exception_event"."subject_ids") = 'array'),
	CONSTRAINT "exception_event_detail_len" CHECK("exception_event"."detail" is null or length("exception_event"."detail") <= 200),
	CONSTRAINT "exception_event_status_shape" CHECK(("exception_event"."status" = 'open' and "exception_event"."resolved_at" is null) or ("exception_event"."status" = 'resolved' and "exception_event"."resolved_at" is not null)),
	CONSTRAINT "exception_event_note_len" CHECK("exception_event"."resolution_note" is null or length("exception_event"."resolution_note") <= 200)
);
--> statement-breakpoint
CREATE INDEX `exception_event_status_idx` ON `exception_event` (`status`);--> statement-breakpoint
CREATE TABLE `item_merge_log` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`action` text NOT NULL,
	`survivor_id` text NOT NULL,
	`merged_id` text NOT NULL,
	`merge_log_id` text,
	`moved_json` text DEFAULT '[]' NOT NULL,
	`moved_batch_ids` text DEFAULT '[]' NOT NULL,
	`moved_barcode_ids` text DEFAULT '[]' NOT NULL,
	`moved_search_name_ids` text DEFAULT '[]' NOT NULL,
	`moved_rows_json` text DEFAULT '[]' NOT NULL,
	`reason` text NOT NULL,
	`user_label` text NOT NULL,
	`reversible_until` integer,
	FOREIGN KEY (`survivor_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merged_id`) REFERENCES `item_variant`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merge_log_id`) REFERENCES `item_merge_log`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_merge_log_action_enum" CHECK("item_merge_log"."action" in ('merge', 'reverse')),
	CONSTRAINT "item_merge_log_two_variants" CHECK("item_merge_log"."survivor_id" <> "item_merge_log"."merged_id"),
	CONSTRAINT "item_merge_log_action_shape" CHECK(("item_merge_log"."action" = 'merge' and "item_merge_log"."merge_log_id" is null and "item_merge_log"."reversible_until" is not null) or ("item_merge_log"."action" = 'reverse' and "item_merge_log"."merge_log_id" is not null and "item_merge_log"."reversible_until" is null)),
	CONSTRAINT "item_merge_log_reason_len" CHECK(length(trim("item_merge_log"."reason")) between 1 and 200 and length("item_merge_log"."reason") <= 200),
	CONSTRAINT "item_merge_log_moved_json_array" CHECK(json_valid("item_merge_log"."moved_json") and json_type("item_merge_log"."moved_json") = 'array'),
	CONSTRAINT "item_merge_log_moved_batches_array" CHECK(json_valid("item_merge_log"."moved_batch_ids") and json_type("item_merge_log"."moved_batch_ids") = 'array'),
	CONSTRAINT "item_merge_log_moved_barcodes_array" CHECK(json_valid("item_merge_log"."moved_barcode_ids") and json_type("item_merge_log"."moved_barcode_ids") = 'array'),
	CONSTRAINT "item_merge_log_moved_names_array" CHECK(json_valid("item_merge_log"."moved_search_name_ids") and json_type("item_merge_log"."moved_search_name_ids") = 'array'),
	CONSTRAINT "item_merge_log_moved_rows_array" CHECK(json_valid("item_merge_log"."moved_rows_json") and json_type("item_merge_log"."moved_rows_json") = 'array')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_merge_log_reverses_once_uq` ON `item_merge_log` (`merge_log_id`);--> statement-breakpoint
CREATE INDEX `item_merge_log_merged_idx` ON `item_merge_log` (`merged_id`);--> statement-breakpoint
-- Hand-written (spec 002 T020): the merge log is append-only; a merge is undone by a 'reverse' row.
CREATE TRIGGER item_merge_log_no_update BEFORE UPDATE ON item_merge_log
BEGIN SELECT RAISE(ABORT, 'item_merge_log is append-only'); END;--> statement-breakpoint
CREATE TRIGGER item_merge_log_no_delete BEFORE DELETE ON item_merge_log
BEGIN SELECT RAISE(ABORT, 'item_merge_log is append-only'); END;--> statement-breakpoint
-- A 'reverse' row must point at a 'merge' row (the unique index makes it once only).
CREATE TRIGGER item_merge_log_reverses_a_merge BEFORE INSERT ON item_merge_log
WHEN NEW.action = 'reverse'
BEGIN
  SELECT RAISE(ABORT, 'item_merge_log: a reversal reverses only a merge')
  WHERE NOT EXISTS (SELECT 1 FROM item_merge_log WHERE id = NEW.merge_log_id AND action = 'merge');
END;--> statement-breakpoint
-- Hand-written (spec 002 T020): an exception goes from open to resolved only, and the update may
-- change nothing but the status, the resolution and the update time.
CREATE TRIGGER exception_event_open_to_resolved BEFORE UPDATE ON exception_event
WHEN NOT (
  OLD.status = 'open' AND NEW.status = 'resolved'
  AND NEW.id = OLD.id AND NEW.business_id = OLD.business_id AND NEW.shop_id = OLD.shop_id
  AND NEW.created_at = OLD.created_at AND NEW.kind = OLD.kind
  AND NEW.subject_type = OLD.subject_type AND NEW.subject_ids = OLD.subject_ids
  AND NEW.detail IS OLD.detail
)
BEGIN SELECT RAISE(ABORT, 'exception_event: status goes from open to resolved only'); END;