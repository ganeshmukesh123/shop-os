ALTER TABLE `bill` ADD `client_bill_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bill_client_bill_id_uq` ON `bill` (`shop_id`,`client_bill_id`);--> statement-breakpoint
-- A saved bill's idempotency key must never change either (constitution I).
DROP TRIGGER bill_only_cancel_update;--> statement-breakpoint
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
