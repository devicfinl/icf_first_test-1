-- =====================================================================================
-- vayana_subscription_entity -> vayana_subscription_entity_new
-- A copy of the targets table with a print and a digital target instead of the single
-- target. MySQL 8.
--
-- How to run (mysql CLI, against the app database):
--   mysql ... < backend/sql/pv-targets-create-new-table.sql
-- Undo: the ROLLBACK block at the end of this file (commented out, so it never runs with
-- the migration). Copy it out and run it on its own.
--
-- The original table is only read, never changed: the app keeps working on it until the
-- code is switched to the new table.
--
-- The new table has the same columns, keys and indexes as the original, except:
--   target        removed
--   targetPrint   INT NOT NULL DEFAULT 0, after setToName  = 40% of target, rounded
--   targetDigital INT NOT NULL DEFAULT 0, after targetPrint = target - targetPrint
-- so print + digital always equals the old target. A missing (NULL) target becomes 0 / 0.
-- Every row keeps its id.
--
-- Refuses to run if vayana_subscription_entity_new already exists, so targets edited in
-- the new table are never overwritten. To build it again, run the rollback first.
-- =====================================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS pv_targets_create $$
CREATE PROCEDURE pv_targets_create()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vayana_subscription_entity_new'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'vayana_subscription_entity_new already exists: nothing changed. Run the rollback first to rebuild it.';
  END IF;

  -- Same columns, primary key, indexes and auto-increment as the original; then every row.
  CREATE TABLE vayana_subscription_entity_new LIKE vayana_subscription_entity;
  INSERT INTO vayana_subscription_entity_new SELECT * FROM vayana_subscription_entity;

  ALTER TABLE vayana_subscription_entity_new
    ADD COLUMN targetPrint   INT NOT NULL DEFAULT 0 AFTER setToName,
    ADD COLUMN targetDigital INT NOT NULL DEFAULT 0 AFTER targetPrint;

  UPDATE vayana_subscription_entity_new
  SET targetPrint   = ROUND(COALESCE(target, 0) * 0.4),
      targetDigital = COALESCE(target, 0) - ROUND(COALESCE(target, 0) * 0.4);

  ALTER TABLE vayana_subscription_entity_new DROP COLUMN target;

  SELECT 'vayana_subscription_entity_new created and filled.' AS result;
END $$

DELIMITER ;

CALL pv_targets_create();
DROP PROCEDURE pv_targets_create;

-- Check against the original, row by row. Expect missing_rows = 0 and mismatches = 0.
SELECT (SELECT COUNT(*) FROM vayana_subscription_entity)                        AS original_rows,
       (SELECT COUNT(*) FROM vayana_subscription_entity_new)                    AS new_rows,
       (SELECT COUNT(*)
        FROM vayana_subscription_entity o
        LEFT JOIN vayana_subscription_entity_new n ON n.id = o.id
        WHERE n.id IS NULL)                                                     AS missing_rows,
       (SELECT COUNT(*)
        FROM vayana_subscription_entity o
        JOIN vayana_subscription_entity_new n ON n.id = o.id
        WHERE n.targetPrint + n.targetDigital <> COALESCE(o.target, 0))         AS mismatches,
       (SELECT SUM(COALESCE(target, 0)) FROM vayana_subscription_entity)        AS sum_target,
       (SELECT SUM(targetPrint) FROM vayana_subscription_entity_new)            AS sum_print,
       (SELECT SUM(targetDigital) FROM vayana_subscription_entity_new)          AS sum_digital;


-- =====================================================================================
-- ROLLBACK (commented out: do NOT uncomment in this file)
-- Drops vayana_subscription_entity_new. The original vayana_subscription_entity was never
-- changed, so nothing in it needs restoring.
-- WARNING: any targets entered in the new table since it was created are lost. Once the
-- app writes to the new table, export it first.
-- To undo, run only these lines, e.g.:
--   mysql ... -e "DROP TABLE IF EXISTS vayana_subscription_entity_new;"
-- =====================================================================================
-- DROP TABLE IF EXISTS vayana_subscription_entity_new;
