-- =====================================================================================
-- Pravasi Vayana targets table: vayana_subscription_entity -> pv_subscription_entity
-- MySQL 8. Builds the new table from the original, from scratch, every time it runs.
--
-- How to run (from backend/):
--   npm run db:migrate:pv-targets
-- or:
--   mysql ... < backend/sql/pv-targets.sql
--
-- The table was called vayana_subscription_entity_new before: a table by that name is dropped
-- too, since this one replaces it.
--
-- WARNING: an existing pv_subscription_entity is DROPPED first and built again from
-- the original. Every target set or changed in the app since (e.g. the next year's targets)
-- is lost. Export the table first if it holds anything worth keeping.
-- The original vayana_subscription_entity is only read, never changed.
--
-- The new table has the same columns, keys, indexes and ids as the original, except:
--   target          removed
--   targetYear      INT NOT NULL, after setToName = 2026: the campaign year the target is for.
--                   The app sets the year on every target it saves (the next year's are started
--                   from the Set Target screen), so the column keeps no default.
--   targetPrint     INT NOT NULL DEFAULT 0, after targetYear  = the old target, whole
--   targetDigital   INT NOT NULL DEFAULT 0, after targetPrint = 0
--                   The old target is not split: all of it is print. NULL becomes 0.
--   created_at      removed: its dates are kept in createdAt and updatedAt
--   createdAt, updatedAt  TIMESTAMP, set by the database from then on
--   KEY idx_target_year_place (targetYear, setToOrg): the app reads one year's targets.
-- Every target is for the 2026 campaign, which is finished: campaign_status = 'Closed'. The
-- app shows and counts a closed year's targets, but they can no longer be changed.
-- =====================================================================================

-- The table's earlier name; this file builds its replacement.
DROP TABLE IF EXISTS vayana_subscription_entity_new;
DROP TABLE IF EXISTS pv_subscription_entity;

-- Same columns, primary key, indexes and auto-increment as the original; then every row.
CREATE TABLE pv_subscription_entity LIKE vayana_subscription_entity;
INSERT INTO pv_subscription_entity SELECT * FROM vayana_subscription_entity;

-- targetYear's default only fills the rows with 2026; it is dropped again below.
ALTER TABLE pv_subscription_entity
  ADD COLUMN targetYear    INT NOT NULL DEFAULT 2026 AFTER setToName,
  ADD COLUMN targetPrint   INT NOT NULL DEFAULT 0 AFTER targetYear,
  ADD COLUMN targetDigital INT NOT NULL DEFAULT 0 AFTER targetPrint,
  ADD COLUMN createdAt     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updatedAt     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD KEY idx_target_year_place (targetYear, setToOrg);

-- Each target keeps the date it was really set; 2026 is finished, so it is closed.
UPDATE pv_subscription_entity
SET targetPrint     = COALESCE(target, 0),
    targetDigital   = 0,
    campaign_status = 'Closed',
    createdAt       = COALESCE(created_at, createdAt),
    updatedAt       = COALESCE(created_at, createdAt);

ALTER TABLE pv_subscription_entity
  DROP COLUMN target,
  DROP COLUMN created_at,
  ALTER COLUMN targetYear DROP DEFAULT;

-- Check against the original, row by row. Expect missing_rows = 0 and mismatches = 0.
SELECT (SELECT COUNT(*) FROM vayana_subscription_entity)                        AS original_rows,
       (SELECT COUNT(*) FROM pv_subscription_entity)                    AS new_rows,
       (SELECT COUNT(*)
        FROM vayana_subscription_entity o
        LEFT JOIN pv_subscription_entity n ON n.id = o.id
        WHERE n.id IS NULL)                                                     AS missing_rows,
       (SELECT COUNT(*)
        FROM vayana_subscription_entity o
        JOIN pv_subscription_entity n ON n.id = o.id
        WHERE n.targetPrint + n.targetDigital <> COALESCE(o.target, 0))         AS mismatches,
       (SELECT SUM(COALESCE(target, 0)) FROM vayana_subscription_entity)        AS sum_target,
       (SELECT SUM(targetPrint) FROM pv_subscription_entity)            AS sum_print,
       (SELECT SUM(targetDigital) FROM pv_subscription_entity)          AS sum_digital;

SELECT targetYear, campaign_status, COUNT(*) AS target_rows
  FROM pv_subscription_entity
 GROUP BY targetYear, campaign_status
 ORDER BY targetYear, campaign_status;


-- =====================================================================================
-- ROLLBACK (commented out: do NOT uncomment in this file)
-- The original vayana_subscription_entity was never changed, so nothing in it needs restoring.
-- To remove the new table:
-- DROP TABLE IF EXISTS pv_subscription_entity;
-- =====================================================================================
