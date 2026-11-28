-- REPLACE can bypass the delete trigger when recursive triggers are off.
CREATE TRIGGER item_merge_log_no_second_reversal BEFORE INSERT ON item_merge_log
BEGIN
  SELECT RAISE(ABORT, 'item_merge_log: merge already reversed')
  WHERE NEW.action = 'reverse'
    AND EXISTS (SELECT 1 FROM item_merge_log WHERE merge_log_id = NEW.merge_log_id);

  SELECT RAISE(ABORT, 'item_merge_log is append-only')
  WHERE EXISTS (SELECT 1 FROM item_merge_log WHERE id = NEW.id AND action = 'reverse');
END;
