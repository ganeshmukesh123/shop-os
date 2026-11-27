-- REPLACE can bypass the delete trigger when recursive triggers are off.
CREATE TRIGGER item_merge_log_no_second_reversal BEFORE INSERT ON item_merge_log
WHEN NEW.action = 'reverse'
  AND EXISTS (SELECT 1 FROM item_merge_log WHERE merge_log_id = NEW.merge_log_id)
BEGIN
  SELECT RAISE(ABORT, 'item_merge_log: merge already reversed');
END;
