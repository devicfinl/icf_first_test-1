-- =====================================================================================
-- Campaigns for Pravasi Vayana targets. Run AFTER pv-targets-create-new-table.sql.
-- MySQL 8.
--
-- How to run (from backend/):
--   npm run db:migrate:pv-campaigns
-- or:
--   mysql ... < backend/sql/pv-targets-add-campaign.sql
-- Undo: the ROLLBACK block at the end of this file (commented out, so it never runs with
-- the migration). Copy it out and run it on its own.
--
-- 1. Creates vayana_campaign: one row per campaign, Draft -> Active -> Closed. Campaigns
--    cover every country; the per-country prices stay in vayana_subscription.
-- 2. Adds to vayana_subscription_entity_new:
--      campaignId  the campaign the target belongs to
--      createdBy, updatedBy  users.id of who set / last changed it (NULL for migrated rows)
--      createdAt, updatedAt
--    and UNIQUE (setToOrg, campaignId): each place gets one target per campaign.
-- 3. Puts every existing target row into a first campaign named 'Migrated targets'
--    (Active, no dates). Rename it and set its dates afterwards.
--
-- Stops before changing anything if a place (setToOrg) has more than one target row, since
-- the unique key could not be added; the duplicates are listed. Fix them and run again.
-- Re-runnable: if campaignId already exists, nothing is changed.
-- =====================================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS pv_targets_add_campaign $$
CREATE PROCEDURE pv_targets_add_campaign()
BEGIN
  DECLARE v_first INT;
  DECLARE v_rows  INT;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vayana_subscription_entity_new'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'vayana_subscription_entity_new does not exist: run pv-targets-create-new-table.sql first.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vayana_subscription_entity_new'
      AND COLUMN_NAME = 'campaignId'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'campaignId already exists: nothing changed.';
  END IF;

  -- Checked before anything changes: the unique key needs one row per place.
  IF EXISTS (
    SELECT 1 FROM vayana_subscription_entity_new GROUP BY setToOrg HAVING COUNT(*) > 1
  ) THEN
    SELECT setToOrg, setToName, COUNT(*) AS target_rows, GROUP_CONCAT(id ORDER BY id) AS ids
    FROM vayana_subscription_entity_new
    GROUP BY setToOrg, setToName
    HAVING COUNT(*) > 1;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Some places have more than one target row (listed above): nothing changed. Keep one row per place and run again.';
  END IF;

  CREATE TABLE IF NOT EXISTS vayana_campaign (
    campaignId INT          NOT NULL AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    startDate  DATE         NULL,
    endDate    DATE         NULL,
    status     ENUM('Draft', 'Active', 'Closed') NOT NULL DEFAULT 'Draft',
    createdBy  INT          NULL,
    createdAt  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (campaignId),
    UNIQUE KEY uq_vayana_campaign_name (name)
  );

  INSERT INTO vayana_campaign (name, status) VALUES ('Migrated targets', 'Active');
  SET v_first = LAST_INSERT_ID();

  -- campaignId starts nullable so the existing rows can be filled, then becomes required.
  ALTER TABLE vayana_subscription_entity_new
    ADD COLUMN campaignId INT       NULL AFTER id,
    ADD COLUMN createdBy  INT       NULL,
    ADD COLUMN updatedBy  INT       NULL,
    ADD COLUMN createdAt  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updatedAt  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

  UPDATE vayana_subscription_entity_new SET campaignId = v_first;
  SET v_rows = ROW_COUNT();

  ALTER TABLE vayana_subscription_entity_new
    MODIFY COLUMN campaignId INT NOT NULL,
    ADD UNIQUE KEY uq_target_place_campaign (setToOrg, campaignId),
    ADD CONSTRAINT fk_target_campaign FOREIGN KEY (campaignId) REFERENCES vayana_campaign (campaignId);

  SELECT CONCAT('vayana_campaign created; ', v_rows, ' target rows moved into campaign ', v_first, ' (Migrated targets).') AS result;
END $$

DELIMITER ;

CALL pv_targets_add_campaign();
DROP PROCEDURE pv_targets_add_campaign;

-- Check. Expect rows_without_campaign = 0.
SELECT (SELECT COUNT(*) FROM vayana_campaign)                                        AS campaigns,
       (SELECT COUNT(*) FROM vayana_subscription_entity_new)                         AS target_rows,
       (SELECT COUNT(*) FROM vayana_subscription_entity_new n
        LEFT JOIN vayana_campaign c ON c.campaignId = n.campaignId
        WHERE c.campaignId IS NULL)                                                  AS rows_without_campaign;


-- =====================================================================================
-- ROLLBACK (commented out: do NOT uncomment in this file)
-- Removes the campaign columns from vayana_subscription_entity_new and drops
-- vayana_campaign. Targets and their print / digital numbers are kept.
-- WARNING: once targets are set for more than one campaign, a place has several rows and
-- this loses which campaign each belongs to. Export both tables first.
-- To undo, run only these lines:
-- =====================================================================================
-- ALTER TABLE vayana_subscription_entity_new
--   DROP FOREIGN KEY fk_target_campaign,
--   DROP INDEX uq_target_place_campaign,
--   DROP COLUMN campaignId,
--   DROP COLUMN createdBy,
--   DROP COLUMN updatedBy,
--   DROP COLUMN createdAt,
--   DROP COLUMN updatedAt;
-- DROP TABLE IF EXISTS vayana_campaign;
