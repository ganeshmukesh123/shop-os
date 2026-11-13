-- Saved bills, bill lines and stock movements are never edited or deleted (constitution I, II).
CREATE TRIGGER stock_movement_no_update BEFORE UPDATE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
CREATE TRIGGER stock_movement_no_delete BEFORE DELETE ON stock_movement
BEGIN SELECT RAISE(ABORT, 'stock_movement is append-only'); END;--> statement-breakpoint
CREATE TRIGGER bill_line_no_update BEFORE UPDATE ON bill_line
BEGIN SELECT RAISE(ABORT, 'bill_line is immutable'); END;--> statement-breakpoint
CREATE TRIGGER bill_line_no_delete BEFORE DELETE ON bill_line
BEGIN SELECT RAISE(ABORT, 'bill_line is immutable'); END;--> statement-breakpoint
CREATE TRIGGER bill_no_delete BEFORE DELETE ON bill
BEGIN SELECT RAISE(ABORT, 'bills cannot be deleted'); END;--> statement-breakpoint
CREATE TRIGGER bill_only_cancel_update BEFORE UPDATE ON bill
WHEN NOT (
  OLD.status = 'saved' AND NEW.status = 'cancelled'
  AND NEW.id = OLD.id AND NEW.number = OLD.number AND NEW.series_code = OLD.series_code
  AND NEW.financial_year = OLD.financial_year AND NEW.seq = OLD.seq AND NEW.bill_date = OLD.bill_date
  AND NEW.customer_name IS OLD.customer_name AND NEW.customer_phone IS OLD.customer_phone
  AND NEW.payment_mode = OLD.payment_mode AND NEW.lines_total_paise = OLD.lines_total_paise
  AND NEW.bill_discount_paise = OLD.bill_discount_paise AND NEW.grand_total_paise = OLD.grand_total_paise
)
BEGIN SELECT RAISE(ABORT, 'a saved bill can only be cancelled, not edited'); END;
